using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AccountService.Models;
using AccountService.Data;
using AccountService.Services;
using System.Linq;

namespace AccountService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AccountController : ControllerBase
    {
        private readonly AccountDbContext _context;
        private readonly IExpressionEvaluationService _expressions;
        private readonly IWorkflowClient _workflow;
        private readonly IDynamicFormsClient _forms;
        private readonly ITransactionServiceClient _transactions;
        private readonly ILogger<AccountController> _logger;

        public AccountController(
            AccountDbContext context,
            IExpressionEvaluationService expressions,
            IWorkflowClient workflow,
            IDynamicFormsClient forms,
            ITransactionServiceClient transactions,
            ILogger<AccountController> logger)
        {
            _context      = context;
            _expressions  = expressions;
            _workflow     = workflow;
            _forms        = forms;
            _transactions = transactions;
            _logger       = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Account>>> GetAccounts()
        {
            return await _context.Accounts
                .Include(a => a.ProductType)
                .Include(a => a.Restrictions)
                .Include(a => a.History)
                .ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Account>> GetAccount(int id)
        {
            var account = await _context.Accounts
                .Include(a => a.ProductType)
                .Include(a => a.Restrictions)
                .Include(a => a.History)
                .FirstOrDefaultAsync(a => a.AccountId == id);
            if (account == null) return NotFound();
            return account;
        }

        [HttpPost]
        public async Task<ActionResult<Account>> CreateAccount(Account account)
        {
            var productType = await _context.AccountProductTypes.FirstOrDefaultAsync(pt => pt.AccountProductTypeId == account.ProductTypeId);
            if (productType == null || !productType.IsActive)
                return BadRequest("Invalid or inactive product type.");
            if (productType.MinimumOpeningAmount.HasValue && account.Balance < productType.MinimumOpeningAmount.Value)
                return BadRequest($"Minimum opening amount for this product is {productType.MinimumOpeningAmount.Value}");

            // ── FD/RD deposit validation ──────────────────────────────────────
            var isDeposit = productType.Name == "FD" || productType.Name == "RD";
            if (isDeposit)
            {
                if (!account.TermMonths.HasValue || account.TermMonths.Value <= 0)
                    return BadRequest("TermMonths is required for FD/RD accounts.");
                account.MaturityDate = account.DateOpened.AddMonths(account.TermMonths.Value);
            }

            account.CreatedBy    = User?.Identity?.Name ?? "system";
            account.ApprovalStatus = "Pending";
            account.CreatedAt    = DateTime.UtcNow;
            _context.Accounts.Add(account);
            await _context.SaveChangesAsync();

            // ── Fetch deposit interest rate from expression engine (fire-and-forget) ──
            if (isDeposit && account.TermMonths.HasValue)
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var rate = await _expressions.CalculateDepositInterestRateAsync(
                            productType.Name, account.Balance, account.TermMonths.Value);
                        if (rate.HasValue)
                        {
                            using var scope = HttpContext.RequestServices.CreateScope();
                            var db = scope.ServiceProvider.GetRequiredService<AccountDbContext>();
                            var a = await db.Accounts.FindAsync(account.AccountId);
                            if (a != null)
                            {
                                a.InterestRate = rate.Value;
                                await db.SaveChangesAsync();
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Interest rate fetch failed for account {Id} — skipping", account.AccountId);
                    }
                });
            }

            // ── Start account-opening workflow (fire-and-forget) ──────────────
            _ = Task.Run(async () =>
            {
                try
                {
                    var wfCtx = new Dictionary<string, object>
                    {
                        ["account.id"]          = account.AccountId.ToString(),
                        ["account.productType"] = productType.Name,
                        ["account.balance"]     = (object)account.Balance
                    };
                    var wf = await _workflow.StartAccountOpeningAsync(Guid.NewGuid(), wfCtx);
                    using var scope = HttpContext.RequestServices.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AccountDbContext>();
                    var a = await db.Accounts.FindAsync(account.AccountId);
                    if (a != null)
                    {
                        a.WorkflowInstanceId = wf.Id;
                        await db.SaveChangesAsync();
                    }
                    _logger.LogInformation("Workflow {WfId} started for account {AccId}", wf.Id, account.AccountId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Workflow start failed for account {Id} — continuing", account.AccountId);
                }
            });

            return CreatedAtAction(nameof(GetAccount), new { id = account.AccountId }, account);
        }

        [HttpPost("{id}/approve")]
        public async Task<IActionResult> ApproveAccount(int id)
        {
            var account = await _context.Accounts.FindAsync(id);
            if (account == null) return NotFound();
            if (account.ApprovalStatus == "Approved") return BadRequest("Already approved.");
            account.ApprovalStatus = "Approved";
            account.ApprovedBy     = User?.Identity?.Name ?? "supervisor";
            account.ApprovedAt     = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // ── Notify workflow engine of approval step (fire-and-forget) ─────
            if (account.WorkflowInstanceId.HasValue)
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var ctx = new Dictionary<string, object>
                        {
                            ["account.id"]     = id.ToString(),
                            ["account.status"] = "APPROVED"
                        };
                        await _workflow.ProcessStepAsync(account.WorkflowInstanceId.Value, "APPROVE", ctx);
                        _logger.LogInformation("Workflow APPROVE step processed for account {Id}", id);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Workflow APPROVE step failed for account {Id} — continuing", id);
                    }
                });
            }

            return Ok(account);
        }

        /// <summary>Get the interest rate applicable to this account from the expression engine.</summary>
        [HttpGet("{id}/eligible-rate")]
        public async Task<ActionResult<object>> GetEligibleRate(int id)
        {
            var account = await _context.Accounts
                .Include(a => a.ProductType)
                .FirstOrDefaultAsync(a => a.AccountId == id);
            if (account == null) return NotFound();

            decimal? rate = null;
            try
            {
                if (account.TermMonths.HasValue && account.ProductType != null)
                {
                    rate = await _expressions.CalculateDepositInterestRateAsync(
                        account.ProductType.Name, account.Balance, account.TermMonths.Value);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Expression engine unavailable for account {Id}", id);
            }

            return Ok(new
            {
                accountId   = id,
                accountType = account.ProductType?.Name,
                interestRate = rate
            });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAccount(int id)
        {
            var account = await _context.Accounts.FindAsync(id);
            if (account == null) return NotFound();
            if (account.IsDeceased) return BadRequest("Cannot delete a deceased/flagged account.");
            if (account.DateClosed != null) return BadRequest("Account already closed.");
            _context.Accounts.Remove(account);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("restricted")]
        public async Task<ActionResult<IEnumerable<Account>>> GetRestrictedAccounts()
        {
            var accounts = await _context.Accounts
                .Include(a => a.Restrictions)
                .Where(a => a.Restrictions != null && a.Restrictions.Any(r => r.IsActive))
                .ToListAsync();
            return accounts;
        }

        [HttpGet("by-type-flag")]
        public async Task<ActionResult<IEnumerable<Account>>> GetAccountsByTypeFlag([FromQuery] bool? isBSBD, [FromQuery] bool? isSimplifiedKYC, [FromQuery] bool? isSpecialScheme)
        {
            var query = _context.Accounts.AsQueryable();
            if (isBSBD.HasValue)
                query = query.Where(a => a.IsBSBD == isBSBD.Value);
            if (isSimplifiedKYC.HasValue)
                query = query.Where(a => a.IsSimplifiedKYC == isSimplifiedKYC.Value);
            if (isSpecialScheme.HasValue)
                query = query.Where(a => a.IsSpecialScheme == isSpecialScheme.Value);
            var accounts = await query.ToListAsync();
            return accounts;
        }

        [HttpPost("{id}/flag-deceased")]
        public async Task<IActionResult> FlagAccountDeceased(int id)
        {
            var account = await _context.Accounts.FindAsync(id);
            if (account == null) return NotFound();
            if (account.IsDeceased) return BadRequest("Account is already flagged as deceased.");
            account.IsDeceased = true;
            await _context.SaveChangesAsync();
            return Ok(account);
        }

        [HttpPost("{id}/unflag-deceased")]
        public async Task<IActionResult> UnflagAccountDeceased(int id)
        {
            var account = await _context.Accounts.FindAsync(id);
            if (account == null) return NotFound();
            if (!account.IsDeceased) return BadRequest("Account is not flagged as deceased.");
            account.IsDeceased = false;
            await _context.SaveChangesAsync();
            return Ok(account);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAccount(int id, Account account)
        {
            if (id != account.AccountId) return BadRequest();
            var existing = await _context.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.AccountId == id);
            if (existing == null) return NotFound();
            if (existing.IsDeceased) return BadRequest("Cannot update a deceased/flagged account.");
            if (existing.DateClosed != null) return BadRequest("Account already closed.");
            account.CreatedBy      = existing.CreatedBy;
            account.CreatedAt      = existing.CreatedAt;
            account.ApprovalStatus = "Pending";
            account.ApprovedBy     = null;
            account.ApprovedAt     = null;
            if (existing.ModeOfOperation != account.ModeOfOperation)
            {
                var history = new AccountHistory
                {
                    AccountId  = account.AccountId,
                    ChangeType = "ModeOfOperation",
                    OldValue   = existing.ModeOfOperation ?? string.Empty,
                    NewValue   = account.ModeOfOperation  ?? string.Empty,
                    ChangeDate = DateTime.UtcNow
                };
                _context.AccountHistories.Add(history);
            }
            _context.Entry(account).State = EntityState.Modified;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Accounts.Any(e => e.AccountId == id))
                    return NotFound();
                else
                    throw;
            }
            return NoContent();
        }

        [HttpGet("by-old-account-number/{oldAccountNumber}")]
        public async Task<ActionResult<Account>> GetByOldAccountNumber(string oldAccountNumber)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.OldAccountNumber == oldAccountNumber);
            if (account == null) return NotFound();
            return account;
        }

        [HttpGet("dormant")]
        public async Task<ActionResult<IEnumerable<Account>>> GetDormantAccounts()
        {
            var twoYearsAgo = DateTime.UtcNow.AddYears(-2);
            var dormantAccounts = await _context.Accounts
                .Include(a => a.History)
                .Where(a => ((a.History == null || !a.History.Any(h => h.ChangeType == "Transaction")) && a.DateOpened < twoYearsAgo) ||
                            (a.History != null && a.History.Any(h => h.ChangeType == "Transaction") && a.History.Where(h => h.ChangeType == "Transaction").Max(h => h.ChangeDate) < twoYearsAgo))
                .ToListAsync();
            return dormantAccounts;
        }

        [HttpPost("{id}/close")]
        public async Task<IActionResult> CloseAccount(int id)
        {
            var account = await _context.Accounts
                .Include(a => a.Restrictions)
                .FirstOrDefaultAsync(a => a.AccountId == id);
            if (account == null) return NotFound();
            if (account.DateClosed != null) return BadRequest("Account already closed.");
            if (account.Restrictions != null && account.Restrictions.Any(r => r.IsActive && r.RestrictionType == "Lien"))
                return BadRequest("Account has active lien/earmarking.");
            if (account.Restrictions != null && account.Restrictions.Any(r => r.IsActive && (r.RestrictionType == "NoOperation" || r.RestrictionType == "NoWithdrawal")))
                return BadRequest("Account has active operation/withdrawal restriction.");
            if (account.Balance < 0)
                return BadRequest("Account has outstanding charges or negative balance.");
            if (account.AccruedInterest > 0 || account.AccruedTDS > 0)
                return BadRequest("Account has pending accrued interest or TDS.");
            account.DateClosed = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(account);
        }

        [HttpGet("{id}/joint-holders")]
        public async Task<ActionResult<IEnumerable<int>>> GetJointHolders(int id)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.AccountId == id);
            if (account == null) return NotFound();
            return Ok(account.JointCustomers ?? new List<int>());
        }

        [HttpPost("{id}/add-joint-holder/{customerId}")]
        public async Task<IActionResult> AddJointHolder(int id, int customerId)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.AccountId == id);
            if (account == null) return NotFound();
            if (account.JointCustomers == null) account.JointCustomers = new List<int>();
            if (account.JointCustomers.Contains(customerId)) return BadRequest("Customer is already a joint holder.");
            account.JointCustomers.Add(customerId);
            await _context.SaveChangesAsync();
            return Ok(account.JointCustomers);
        }

        [HttpDelete("{id}/remove-joint-holder/{customerId}")]
        public async Task<IActionResult> RemoveJointHolder(int id, int customerId)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.AccountId == id);
            if (account == null) return NotFound();
            if (account.JointCustomers == null) account.JointCustomers = new List<int>();
            if (!account.JointCustomers.Contains(customerId)) return NotFound("Customer is not a joint holder.");
            account.JointCustomers.Remove(customerId);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("{id}/nominees")]
        public async Task<ActionResult<IEnumerable<Nominee>>> GetNominees(int id)
        {
            var account = await _context.Accounts.Include(a => a.Nominees).FirstOrDefaultAsync(a => a.AccountId == id);
            if (account == null) return NotFound();
            return Ok(account.Nominees ?? new List<Nominee>());
        }

        [HttpPost("{id}/add-nominee")]
        public async Task<IActionResult> AddNominee(int id, [FromBody] Nominee nominee)
        {
            var account = await _context.Accounts.Include(a => a.Nominees).FirstOrDefaultAsync(a => a.AccountId == id);
            if (account == null) return NotFound();
            nominee.AccountId = id;
            _context.Nominees.Add(nominee);
            await _context.SaveChangesAsync();
            return Ok(nominee);
        }

        [HttpPut("{id}/update-nominee/{nomineeId}")]
        public async Task<IActionResult> UpdateNominee(int id, int nomineeId, [FromBody] Nominee nominee)
        {
            if (nomineeId != nominee.NomineeId || nominee.AccountId != id) return BadRequest();
            var existing = await _context.Nominees.FirstOrDefaultAsync(n => n.NomineeId == nomineeId && n.AccountId == id);
            if (existing == null) return NotFound();
            existing.Name            = nominee.Name;
            existing.Relationship    = nominee.Relationship;
            existing.DateOfBirth     = nominee.DateOfBirth;
            existing.Address         = nominee.Address;
            existing.PercentageShare = nominee.PercentageShare;
            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        [HttpDelete("{id}/remove-nominee/{nomineeId}")]
        public async Task<IActionResult> RemoveNominee(int id, int nomineeId)
        {
            var nominee = await _context.Nominees.FirstOrDefaultAsync(n => n.NomineeId == nomineeId && n.AccountId == id);
            if (nominee == null) return NotFound();
            _context.Nominees.Remove(nominee);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("{id}/passbooks")]
        public async Task<ActionResult<IEnumerable<Passbook>>> GetPassbooks(int id)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.AccountId == id);
            if (account == null) return NotFound();
            var passbooks = await _context.Passbooks.Where(p => p.AccountId == id).ToListAsync();
            return Ok(passbooks);
        }

        [HttpGet("{id}/passbooks/{passbookId}")]
        public async Task<ActionResult<Passbook>> GetPassbook(int id, int passbookId)
        {
            var passbook = await _context.Passbooks.FirstOrDefaultAsync(p => p.AccountId == id && p.PassbookId == passbookId);
            if (passbook == null) return NotFound();
            return Ok(passbook);
        }

        [HttpPost("{id}/issue-passbook")]
        public async Task<IActionResult> IssuePassbook(int id, [FromBody] string? remarks)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.AccountId == id);
            if (account == null) return NotFound();
            var passbook = new Passbook
            {
                AccountId      = id,
                PassbookNumber = $"PBK-{id}-{DateTime.UtcNow:yyyyMMddHHmmss}",
                IssuedDate     = DateTime.UtcNow,
                IssuedBy       = User?.Identity?.Name ?? "system",
                Remarks        = remarks
            };
            _context.Passbooks.Add(passbook);
            await _context.SaveChangesAsync();
            return Ok(passbook);
        }

        // ── SCRUM-225: GET /api/account/upcoming-maturities ──────────────────────
        /// <summary>
        /// Returns FD/RD accounts whose MaturityDate falls within the next <paramref name="days"/> days.
        /// Default window: 30 days. Also projects the maturity interest for each account.
        /// </summary>
        [HttpGet("upcoming-maturities")]
        public async Task<ActionResult<IEnumerable<object>>> GetUpcomingMaturities([FromQuery] int days = 30)
        {
            var from = DateTime.UtcNow;
            var to   = from.AddDays(days);

            var accounts = await _context.Accounts
                .Include(a => a.ProductType)
                .Where(a =>
                    a.MaturityDate.HasValue &&
                    a.MaturityDate.Value >= from &&
                    a.MaturityDate.Value <= to &&
                    a.DateClosed == null)
                .OrderBy(a => a.MaturityDate)
                .ToListAsync();

            var results = accounts.Select(a =>
            {
                var principal    = a.Balance;
                var annualRate   = a.InterestRate ?? 0m;
                var termMonths   = (decimal)(a.TermMonths ?? 0);
                var interest     = Math.Round(principal * annualRate / 100m * termMonths / 12m, 2);
                var daysToExpiry = (a.MaturityDate!.Value - from).Days;

                return (object)new
                {
                    accountId      = a.AccountId,
                    accountNumber  = a.AccountNumber,
                    customerId     = a.CustomerId,
                    productType    = a.ProductType?.Name,
                    principal,
                    annualRate,
                    termMonths     = a.TermMonths,
                    maturityDate   = a.MaturityDate,
                    daysToMaturity = daysToExpiry,
                    projectedInterest = interest,
                    projectedPayout   = principal + interest,
                    autoRenewal    = a.AutoRenewal
                };
            });

            return Ok(results);
        }

        // ── SCRUM-223: POST /api/account/{id}/mature ──────────────────────────────
        /// <summary>
        /// Matures a Fixed Deposit or Recurring Deposit account.
        /// - Computes maturity interest via EXPR_MATURITY_INTEREST_CALC
        /// - Posts DR 2010 / DR 5010 / CR 1010 journal to TransactionService
        /// - If AutoRenewal = true: resets term and maturity date; status stays Active
        /// - Else: status → "Mature", DateClosed = UtcNow
        /// </summary>
        [HttpPost("{id}/mature")]
        public async Task<ActionResult<object>> MatureAccount(int id)
        {
            var account = await _context.Accounts
                .Include(a => a.ProductType)
                .FirstOrDefaultAsync(a => a.AccountId == id);

            if (account == null) return NotFound();
            if (account.DateClosed != null) return BadRequest("Account is already closed.");
            if (!account.TermMonths.HasValue) return BadRequest("Account is not a term deposit (no TermMonths set).");
            if (account.Status == "Mature") return BadRequest("Account has already been matured.");

            // ── Calculate maturity interest via expression engine ─────────────────
            decimal interest = 0m;
            var principal    = account.Balance;
            var annualRate   = account.InterestRate ?? 0m;
            var termMonths   = (decimal)account.TermMonths.Value;

            try
            {
                interest = await _expressions.EvaluateExpressionAsync<decimal>(
                    "EXPR_MATURITY_INTEREST_CALC",
                    new Dictionary<string, object>
                    {
                        ["principal"]  = principal,
                        ["annualRate"] = annualRate,
                        ["termMonths"] = termMonths
                    });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "EXPR_MATURITY_INTEREST_CALC failed for account {Id} — computing locally", id);
                interest = Math.Round(principal * annualRate / 100m * termMonths / 12m, 2);
            }

            // ── Post double-entry journal to TransactionService ───────────────────
            var accountNo  = account.AccountNumber ?? id.ToString();
            var productName = account.ProductType?.Name ?? "FD";

            var journalResult = await _transactions.PostMaturityPayoutAsync(
                accountNo, productName, principal, interest);

            if (!journalResult.Success)
                _logger.LogWarning("Maturity journal failed for account {Id} — {Error}. Proceeding.", id, journalResult.Error);
            else
                _logger.LogInformation("Maturity journal {JNo} posted for account {Id}", journalResult.JournalNumber, id);

            // ── AutoRenewal: reset term and maturity date ─────────────────────────
            if (account.AutoRenewal && account.TermMonths.HasValue)
            {
                account.MaturityDate = DateTime.UtcNow.AddMonths(account.TermMonths.Value);
                // Re-fetch applicable rate for the new term
                try
                {
                    var newRate = await _expressions.CalculateDepositInterestRateAsync(
                        productName, principal, account.TermMonths.Value);
                    if (newRate.HasValue)
                        account.InterestRate = newRate.Value;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Rate refresh for auto-renewal of account {Id} failed — keeping existing rate", id);
                }

                if (journalResult.Success)
                    account.MaturityJournalNumber = journalResult.JournalNumber;

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    accountId     = account.AccountId,
                    accountNumber = accountNo,
                    status        = account.Status,
                    autoRenewed   = true,
                    newMaturityDate = account.MaturityDate,
                    maturityInterest = interest,
                    journalNumber  = journalResult.JournalNumber
                });
            }

            // ── No auto-renewal: mark Mature and close ────────────────────────────
            account.Status     = "Mature";
            account.DateClosed = DateTime.UtcNow;
            if (journalResult.Success)
                account.MaturityJournalNumber = journalResult.JournalNumber;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                accountId     = account.AccountId,
                accountNumber = accountNo,
                status        = account.Status,
                autoRenewed   = false,
                maturityDate  = account.MaturityDate,
                maturityInterest = interest,
                totalPayout   = principal + interest,
                journalNumber  = journalResult.JournalNumber
            });
        }

        // ── SCRUM-224: POST /api/account/{id}/premature-close ─────────────────────
        /// <summary>
        /// Closes an FD/RD before its maturity date, applying the premature closure penalty.
        /// - Computes reduced interest via EXPR_PREMATURE_CLOSURE_PENALTY_CALC
        /// - Posts DR 2010 / DR 5010 / CR 1010 journal to TransactionService
        /// - Sets status → "Closed", DateClosed = UtcNow
        /// </summary>
        [HttpPost("{id}/premature-close")]
        public async Task<ActionResult<object>> PrematureClose(int id)
        {
            var account = await _context.Accounts
                .Include(a => a.ProductType)
                .FirstOrDefaultAsync(a => a.AccountId == id);

            if (account == null) return NotFound();
            if (account.DateClosed != null) return BadRequest("Account is already closed.");
            if (!account.TermMonths.HasValue) return BadRequest("Account is not a term deposit (no TermMonths set).");
            if (account.Status == "Mature") return BadRequest("Account has already matured. Use /mature instead.");

            var principal      = account.Balance;
            var annualRate     = account.InterestRate ?? 0m;
            var penaltyPercent = account.PrematureClosurePenalty ?? 1.0m;

            // Actual months held since account was opened
            var actualMonths = (decimal)(DateTime.UtcNow - account.DateOpened).TotalDays / 30.44m;
            actualMonths     = Math.Max(0m, Math.Min(actualMonths, (decimal)(account.TermMonths ?? 0)));

            // ── Calculate reduced interest after penalty ───────────────────────────
            decimal reducedInterest = 0m;
            try
            {
                reducedInterest = await _expressions.EvaluateExpressionAsync<decimal>(
                    "EXPR_PREMATURE_CLOSURE_PENALTY_CALC",
                    new Dictionary<string, object>
                    {
                        ["principal"]      = principal,
                        ["annualRate"]     = annualRate,
                        ["penaltyPercent"] = penaltyPercent,
                        ["actualMonths"]   = actualMonths
                    });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "EXPR_PREMATURE_CLOSURE_PENALTY_CALC failed for account {Id} — computing locally", id);
                reducedInterest = Math.Round(
                    principal * Math.Max(0m, annualRate - penaltyPercent) / 100m * actualMonths / 12m, 2);
            }

            // ── Post double-entry journal ─────────────────────────────────────────
            var accountNo   = account.AccountNumber ?? id.ToString();
            var productName = account.ProductType?.Name ?? "FD";

            var journalResult = await _transactions.PostPrematureClosureAsync(
                accountNo, productName, principal, reducedInterest);

            if (!journalResult.Success)
                _logger.LogWarning("Premature closure journal failed for account {Id} — {Error}. Proceeding.", id, journalResult.Error);
            else
                _logger.LogInformation("Premature closure journal {JNo} posted for account {Id}", journalResult.JournalNumber, id);

            // ── Mark closed ───────────────────────────────────────────────────────
            account.Status     = "Closed";
            account.DateClosed = DateTime.UtcNow;
            if (journalResult.Success)
                account.MaturityJournalNumber = journalResult.JournalNumber;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                accountId       = account.AccountId,
                accountNumber   = accountNo,
                status          = account.Status,
                closedAt        = account.DateClosed,
                principal,
                annualRate,
                penaltyPercent,
                actualMonthsHeld = Math.Round(actualMonths, 1),
                reducedInterest,
                totalPayout     = principal + reducedInterest,
                journalNumber   = journalResult.JournalNumber
            });
        }

        // ── SCRUM-229: POST /api/account/{id}/freeze ──────────────────────────────
        /// <summary>Freezes an active account — no debits/credits allowed.</summary>
        [HttpPost("{id}/freeze")]
        public async Task<ActionResult<object>> FreezeAccount(int id)
        {
            var account = await _context.Accounts.FindAsync(id);
            if (account == null) return NotFound();
            if (account.DateClosed != null) return BadRequest("Account is already closed.");
            if (account.Status == "Frozen") return BadRequest("Account is already frozen.");

            account.Status = "Frozen";
            await _context.SaveChangesAsync();

            _logger.LogInformation("Account {Id} ({No}) frozen.", id, account.AccountNumber);
            return Ok(new { accountId = account.AccountId, accountNumber = account.AccountNumber, status = account.Status });
        }

        // ── SCRUM-229: POST /api/account/{id}/unfreeze ────────────────────────────
        /// <summary>Unfreezes a frozen account, restoring it to Active.</summary>
        [HttpPost("{id}/unfreeze")]
        public async Task<ActionResult<object>> UnfreezeAccount(int id)
        {
            var account = await _context.Accounts.FindAsync(id);
            if (account == null) return NotFound();
            if (account.Status != "Frozen") return BadRequest("Account is not frozen.");

            account.Status = "Active";
            await _context.SaveChangesAsync();

            _logger.LogInformation("Account {Id} ({No}) unfrozen.", id, account.AccountNumber);
            return Ok(new { accountId = account.AccountId, accountNumber = account.AccountNumber, status = account.Status });
        }

        // ── SAAR-EXPR-001: POST /api/account/{id}/calculate-fee ──────────────────
        /// <summary>
        /// Calculates and charges the monthly account maintenance fee.
        /// Evaluates EXPR_AMC_FEE_UCB (FeeCalculation category) via ExpressionBuilderService.
        /// Falls back to ₹50 (savings) / ₹100 (current) if expression service is unavailable.
        /// Fee = 0 → waived; fee > 0 → debit posted via TransactionService.
        /// </summary>
        [HttpPost("{id}/calculate-fee")]
        public async Task<ActionResult<object>> CalculateMaintenanceFee(
            int id, [FromBody] CalculateFeeRequest? req)
        {
            var account = await _context.Accounts
                .Include(a => a.ProductType)
                .FirstOrDefaultAsync(a => a.AccountId == id);
            if (account == null) return NotFound();
            if (account.DateClosed != null) return BadRequest("Account is closed.");
            if (account.Status == "Frozen")  return BadRequest("Account is frozen.");

            var accountType  = account.ProductType?.Name?.ToUpper() ?? "SAVINGS";
            var accountAge   = (int)((DateTime.UtcNow - account.DateOpened).TotalDays / 30);
            var customerSeg  = req?.CustomerSegment ?? "REGULAR";
            var minBalance   = account.ProductType?.MinimumOpeningAmount ?? 0m;
            var avgBalance   = account.Balance; // proxy: use current balance as monthly average

            var fee = await _expressions.CalculateMaintenanceFeeAsync(
                avgBalance, accountType, accountAge, customerSeg, minBalance);

            if (fee <= 0m)
            {
                _logger.LogInformation(
                    "AMC waived for account {Id} ({No}) — segment={Seg}.",
                    id, account.AccountNumber, customerSeg);
                return Ok(new { accountId = id, fee = 0m, applied = false });
            }

            var postedBy = User?.Identity?.Name ?? "system";
            var result   = await _transactions.PostMaintenanceFeeAsync(
                account.AccountNumber, fee, postedBy);

            if (!result.Success)
            {
                _logger.LogWarning(
                    "Failed to post AMC journal for account {Id}: {Err}", id, result.Error);
                return StatusCode(503, new { error = "Fee calculated but could not post journal.", fee });
            }

            _logger.LogInformation(
                "AMC ₹{Fee} charged for account {Id} ({No}) — journal {JN}.",
                fee, id, account.AccountNumber, result.JournalNumber);
            return Ok(new { accountId = id, fee, applied = true, journalNumber = result.JournalNumber });
        }
    }

    /// <summary>Request body for POST /api/account/{id}/calculate-fee.</summary>
    public class CalculateFeeRequest
    {
        /// <summary>Customer segment for fee waiver logic: REGULAR / PRIORITY / SENIOR_CITIZEN / STAFF</summary>
        public string CustomerSegment { get; set; } = "REGULAR";
    }
}

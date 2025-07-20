using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AccountService.Models;
using AccountService.Data;
using System.Linq;

namespace AccountService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AccountController : ControllerBase
    {
        private readonly AccountDbContext _context;
        public AccountController(AccountDbContext context)
        {
            _context = context;
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
            // TODO: Integrate with CustomerService for customer validation
            // For now, skip customer checks and focus on product type and business rules
            var productType = await _context.AccountProductTypes.FirstOrDefaultAsync(pt => pt.AccountProductTypeId == account.ProductTypeId);
            if (productType == null || !productType.IsActive)
                return BadRequest("Invalid or inactive product type.");
            if (productType.MinimumOpeningAmount.HasValue && account.Balance < productType.MinimumOpeningAmount.Value)
                return BadRequest($"Minimum opening amount for this product is {productType.MinimumOpeningAmount.Value}");
            account.CreatedBy = User?.Identity?.Name ?? "system";
            account.ApprovalStatus = "Pending";
            account.CreatedAt = DateTime.UtcNow;
            _context.Accounts.Add(account);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetAccount), new { id = account.AccountId }, account);
        }

        [HttpPost("{id}/approve")]
        public async Task<IActionResult> ApproveAccount(int id)
        {
            var account = await _context.Accounts.FindAsync(id);
            if (account == null) return NotFound();
            if (account.ApprovalStatus == "Approved") return BadRequest("Already approved.");
            account.ApprovalStatus = "Approved";
            account.ApprovedBy = User?.Identity?.Name ?? "supervisor";
            account.ApprovedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(account);
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
            account.CreatedBy = existing.CreatedBy;
            account.CreatedAt = existing.CreatedAt;
            account.ApprovalStatus = "Pending";
            account.ApprovedBy = null;
            account.ApprovedAt = null;
            if (existing.ModeOfOperation != account.ModeOfOperation)
            {
                var history = new AccountHistory
                {
                    AccountId = account.AccountId,
                    ChangeType = "ModeOfOperation",
                    OldValue = existing.ModeOfOperation ?? string.Empty,
                    NewValue = account.ModeOfOperation ?? string.Empty,
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
            existing.Name = nominee.Name;
            existing.Relationship = nominee.Relationship;
            existing.DateOfBirth = nominee.DateOfBirth;
            existing.Address = nominee.Address;
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
                AccountId = id,
                PassbookNumber = $"PBK-{id}-{DateTime.UtcNow:yyyyMMddHHmmss}",
                IssuedDate = DateTime.UtcNow,
                IssuedBy = User?.Identity?.Name ?? "system",
                Remarks = remarks
            };
            _context.Passbooks.Add(passbook);
            await _context.SaveChangesAsync();
            return Ok(passbook);
        }
    }
}

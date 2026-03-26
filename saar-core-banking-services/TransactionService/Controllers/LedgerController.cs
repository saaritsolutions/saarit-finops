using Microsoft.AspNetCore.Mvc;
using TransactionService.Services;

namespace TransactionService.Controllers
{
    /// <summary>Ledger balance and entry queries.</summary>
    [ApiController]
    [Route("api/[controller]")]
    public class LedgerController : ControllerBase
    {
        private readonly ILedgerService _ledger;

        public LedgerController(ILedgerService ledger) => _ledger = ledger;

        /// <summary>Get the current running balance for a specific GL account code (e.g. 1010, 2010).</summary>
        [HttpGet("balance/{accountCode}")]
        [ProducesResponseType(typeof(LedgerBalanceDto), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> GetBalance(string accountCode, CancellationToken ct)
        {
            var dto = await _ledger.GetBalanceAsync(accountCode, ct);
            return dto == null ? NotFound(new { error = $"Account {accountCode} not found." }) : Ok(dto);
        }

        /// <summary>Get balances for all active GL accounts in the chart of accounts.</summary>
        [HttpGet("balances")]
        [ProducesResponseType(typeof(IReadOnlyList<LedgerBalanceDto>), 200)]
        public async Task<IActionResult> GetAllBalances(CancellationToken ct)
        {
            var dtos = await _ledger.GetAllBalancesAsync(ct);
            return Ok(dtos);
        }

        /// <summary>Get journal entries for a specific GL account, newest first.</summary>
        [HttpGet("entries/{accountCode}")]
        [ProducesResponseType(200)]
        public async Task<IActionResult> GetEntries(
            string accountCode,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            CancellationToken ct = default)
        {
            pageSize = Math.Min(pageSize, 200);
            var entries = await _ledger.GetEntriesAsync(accountCode, page, pageSize, ct);
            return Ok(entries);
        }
    }
}

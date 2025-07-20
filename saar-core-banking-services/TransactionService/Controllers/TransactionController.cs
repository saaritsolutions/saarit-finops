using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TransactionService.Data;
using TransactionService.Models;

namespace TransactionService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TransactionController : ControllerBase
    {
        private readonly TransactionDbContext _context;
        public TransactionController(TransactionDbContext context)
        {
            _context = context;
        }

        [HttpGet("receipts")]
        public async Task<ActionResult<IEnumerable<Receipt>>> GetReceipts()
        {
            return await _context.Receipts.ToListAsync();
        }

        [HttpPost("receipts")]
        public async Task<ActionResult<Receipt>> CreateReceipt(Receipt receipt)
        {
            _context.Receipts.Add(receipt);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetReceipts), new { id = receipt.ReceiptId }, receipt);
        }

        [HttpGet("account-history")]
        public async Task<ActionResult<IEnumerable<AccountHistory>>> GetAccountHistories()
        {
            return await _context.AccountHistories.ToListAsync();
        }

        [HttpPost("account-history")]
        public async Task<ActionResult<AccountHistory>> CreateAccountHistory(AccountHistory history)
        {
            _context.AccountHistories.Add(history);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetAccountHistories), new { id = history.AccountHistoryId }, history);
        }
    }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AccountService.Data;
using AccountService.Models;

namespace AccountService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AccountsController : ControllerBase
    {
        private readonly AccountDbContext _context;
        public AccountsController(AccountDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Account>>> GetAccounts()
        {
            return await _context.Accounts.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Account>> GetAccount(int id)
        {
            var account = await _context.Accounts.FindAsync(id);
            if (account == null) return NotFound();
            return account;
        }

        [HttpPost]
        public async Task<ActionResult<Account>> CreateAccount(Account account)
        {
            _context.Accounts.Add(account);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetAccount), new { id = account.AccountId }, account);
        }
    }
}

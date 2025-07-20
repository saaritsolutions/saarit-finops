using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AuditLoggingService.Models;

namespace AuditLoggingService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuditLogsController : ControllerBase
    {
        private readonly AuditLogDbContext _context;
        public AuditLogsController(AuditLogDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<AuditLog>>> GetAuditLogs()
        {
            return await _context.AuditLogs.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<AuditLog>> GetAuditLog(int id)
        {
            var log = await _context.AuditLogs.FindAsync(id);
            if (log == null) return NotFound();
            return log;
        }

        [HttpPost]
        public async Task<ActionResult<AuditLog>> CreateAuditLog(AuditLog log)
        {
            _context.AuditLogs.Add(log);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetAuditLog), new { id = log.Id }, log);
        }
    }
}

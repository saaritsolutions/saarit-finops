using Microsoft.AspNetCore.Mvc;
using TransactionService.Models;
using TransactionService.Services;

namespace TransactionService.Controllers
{
    /// <summary>Double-entry journal posting and retrieval.</summary>
    [ApiController]
    [Route("api/[controller]")]
    public class JournalController : ControllerBase
    {
        private readonly IPostingEngine _engine;
        private readonly ILogger<JournalController> _logger;

        public JournalController(IPostingEngine engine, ILogger<JournalController> logger)
        {
            _engine = engine;
            _logger = logger;
        }

        /// <summary>Post a new double-entry journal. Supply an IdempotencyKey to prevent duplicate posts.</summary>
        [HttpPost]
        [ProducesResponseType(typeof(Journal), 201)]
        [ProducesResponseType(typeof(ProblemDetails), 400)]
        public async Task<IActionResult> Post([FromBody] PostJournalRequest request, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
                return BadRequest(new { error = "IdempotencyKey is required." });

            try
            {
                var journal = await _engine.PostAsync(request, ct);
                return CreatedAtAction(nameof(GetById), new { id = journal.JournalId }, journal);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Journal rejected: {Message}", ex.Message);
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>Get a journal by its database ID.</summary>
        [HttpGet("{id:long}")]
        [ProducesResponseType(typeof(Journal), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> GetById(long id, CancellationToken ct)
        {
            var journal = await _engine.GetByIdAsync(id, ct);
            return journal == null ? NotFound() : Ok(journal);
        }

        /// <summary>Look up a journal by its idempotency key.</summary>
        [HttpGet("by-key/{key}")]
        [ProducesResponseType(typeof(Journal), 200)]
        [ProducesResponseType(404)]
        public async Task<IActionResult> GetByKey(string key, CancellationToken ct)
        {
            var journal = await _engine.GetByIdempotencyKeyAsync(key, ct);
            return journal == null ? NotFound() : Ok(journal);
        }

        /// <summary>List recent journals, newest first.</summary>
        [HttpGet]
        [ProducesResponseType(typeof(IReadOnlyList<Journal>), 200)]
        public async Task<IActionResult> List(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            CancellationToken ct = default)
        {
            pageSize = Math.Min(pageSize, 100);
            var journals = await _engine.GetRecentAsync(page, pageSize, ct);
            return Ok(journals);
        }
    }
}

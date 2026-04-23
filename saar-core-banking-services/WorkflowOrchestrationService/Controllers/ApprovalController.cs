using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkflowOrchestrationService.Data;
using WorkflowOrchestrationService.Models;

namespace WorkflowOrchestrationService.Controllers
{
    /// <summary>
    /// Multi-level approval chain: configuration (ApprovalLevel) + per-entity instances (ApprovalChainStep).
    /// SAAR-WF-001 — sequential approval routing based on loan amount bands.
    /// </summary>
    [ApiController]
    [Route("api/approval")]
    public class ApprovalController : ControllerBase
    {
        private readonly WorkflowDbContext _db;
        private readonly ILogger<ApprovalController> _logger;

        public ApprovalController(WorkflowDbContext db, ILogger<ApprovalController> logger)
        {
            _db     = db;
            _logger = logger;
        }

        // ── GET /api/approval/levels ────────────────────────────────────────────
        /// <summary>List configured approval levels, optionally filtered by workflowType.</summary>
        [HttpGet("levels")]
        public async Task<ActionResult<IEnumerable<ApprovalLevel>>> GetLevels(
            [FromQuery] string? workflowType)
        {
            var query = _db.ApprovalLevels.AsQueryable();
            if (!string.IsNullOrWhiteSpace(workflowType))
                query = query.Where(l => l.WorkflowType == workflowType);

            var levels = await query.OrderBy(l => l.Sequence).ToListAsync();
            return Ok(levels);
        }

        // ── POST /api/approval/chain/init ───────────────────────────────────────
        /// <summary>
        /// Initialise an approval chain for an entity (e.g., a loan application).
        /// Looks up ApprovalLevels for the workflowType + amount, creates one ApprovalChainStep per required level.
        /// Idempotent: returns existing steps if already initialised.
        /// </summary>
        [HttpPost("chain/init")]
        public async Task<ActionResult<IEnumerable<ApprovalChainStep>>> InitChain(
            [FromBody] InitChainRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.EntityId) || string.IsNullOrWhiteSpace(request.EntityType))
                return BadRequest(new { error = "EntityId and EntityType are required" });

            // Idempotency: return existing steps if already initialised
            var existing = await _db.ApprovalChainSteps
                .Where(s => s.EntityId == request.EntityId && s.EntityType == request.EntityType)
                .OrderBy(s => s.Sequence)
                .ToListAsync();

            if (existing.Any())
            {
                _logger.LogDebug("Chain already initialised for {EntityType}/{EntityId}", request.EntityType, request.EntityId);
                return Ok(existing);
            }

            // Find levels required for this amount
            var requiredLevels = await _db.ApprovalLevels
                .Where(l => l.WorkflowType == request.WorkflowType
                         && request.Amount >= l.AmountMin
                         && request.Amount <= l.AmountMax)
                .OrderBy(l => l.Sequence)
                .ToListAsync();

            if (!requiredLevels.Any())
            {
                // Fallback: always require at least 1 level (Branch Manager)
                requiredLevels = await _db.ApprovalLevels
                    .Where(l => l.WorkflowType == request.WorkflowType && l.Sequence == 1)
                    .ToListAsync();
            }

            var steps = requiredLevels.Select(l => new ApprovalChainStep
            {
                Id           = Guid.NewGuid(),
                EntityId     = request.EntityId,
                EntityType   = request.EntityType,
                Sequence     = l.Sequence,
                Label        = l.Label,
                RequiredRole = l.RequiredRole,
                Status       = "PENDING",
                CreatedAt    = DateTime.UtcNow
            }).ToList();

            _db.ApprovalChainSteps.AddRange(steps);
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Approval chain initialised for {EntityType}/{EntityId}: {Count} steps (amount ₹{Amount:N0})",
                request.EntityType, request.EntityId, steps.Count, request.Amount);

            return Ok(steps);
        }

        // ── GET /api/approval/chain ─────────────────────────────────────────────
        /// <summary>Get all chain steps for an entity, ordered by sequence.</summary>
        [HttpGet("chain")]
        public async Task<ActionResult<ApprovalChainResponse>> GetChain(
            [FromQuery] string entityId,
            [FromQuery] string entityType)
        {
            if (string.IsNullOrWhiteSpace(entityId) || string.IsNullOrWhiteSpace(entityType))
                return BadRequest(new { error = "entityId and entityType are required" });

            var steps = await _db.ApprovalChainSteps
                .Where(s => s.EntityId == entityId && s.EntityType == entityType)
                .OrderBy(s => s.Sequence)
                .ToListAsync();

            return Ok(new ApprovalChainResponse
            {
                EntityId   = entityId,
                EntityType = entityType,
                Steps      = steps
            });
        }

        // ── POST /api/approval/chain/steps/{stepId}/action ─────────────────────
        /// <summary>
        /// Submit an approval action (APPROVE or REJECT) at a specific chain step.
        /// REJECT marks all remaining PENDING steps as SKIPPED.
        /// Sequential enforcement: Level N+1 is blocked until Level N is APPROVED.
        /// </summary>
        [HttpPost("chain/steps/{stepId:guid}/action")]
        public async Task<ActionResult<ApprovalChainStep>> SubmitStepAction(
            Guid stepId,
            [FromBody] ChainStepActionRequest request)
        {
            var step = await _db.ApprovalChainSteps.FindAsync(stepId);
            if (step == null)
                return NotFound(new { error = $"Chain step {stepId} not found" });

            if (step.Status != "PENDING")
                return BadRequest(new { error = $"Step is already {step.Status}" });

            // Sequential enforcement: previous step must be APPROVED
            var priorPending = await _db.ApprovalChainSteps
                .Where(s => s.EntityId   == step.EntityId
                         && s.EntityType == step.EntityType
                         && s.Sequence   <  step.Sequence
                         && s.Status     != "APPROVED")
                .AnyAsync();

            if (priorPending)
                return BadRequest(new { error = "Previous approval level must be completed first" });

            var action = request.Action.ToUpperInvariant();
            if (action != "APPROVE" && action != "REJECT")
                return BadRequest(new { error = "Action must be APPROVE or REJECT" });

            step.Status      = action == "APPROVE" ? "APPROVED" : "REJECTED";
            step.PerformedBy = request.PerformedBy;
            step.Comments    = request.Comments;
            step.ActionedAt  = DateTime.UtcNow;

            // On rejection — skip all remaining PENDING steps
            if (action == "REJECT")
            {
                var remaining = await _db.ApprovalChainSteps
                    .Where(s => s.EntityId   == step.EntityId
                             && s.EntityType == step.EntityType
                             && s.Sequence   >  step.Sequence
                             && s.Status     == "PENDING")
                    .ToListAsync();

                foreach (var r in remaining)
                    r.Status = "SKIPPED";
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Chain step {StepId} ({Label}) {Action} by {By} for {EntityType}/{EntityId}",
                stepId, step.Label, action, request.PerformedBy, step.EntityType, step.EntityId);

            return Ok(step);
        }
    }

    // ── Request / Response records ──────────────────────────────────────────────

    public record InitChainRequest(
        string  EntityId,
        string  EntityType,
        string  WorkflowType,
        decimal Amount);

    public record ChainStepActionRequest(
        string  Action,
        string? PerformedBy,
        string? Comments);

    public class ApprovalChainResponse
    {
        public string                   EntityId   { get; set; } = string.Empty;
        public string                   EntityType { get; set; } = string.Empty;
        public List<ApprovalChainStep>  Steps      { get; set; } = new();
    }
}

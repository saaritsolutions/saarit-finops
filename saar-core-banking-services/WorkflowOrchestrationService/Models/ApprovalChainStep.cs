namespace WorkflowOrchestrationService.Models
{
    /// <summary>
    /// Persists one required approval step per loan application (or other entity).
    /// Created by POST /api/approval/chain/init when the loan moves to IN_REVIEW.
    /// </summary>
    public class ApprovalChainStep
    {
        public Guid    Id           { get; set; } = Guid.NewGuid();
        public string  EntityId     { get; set; } = string.Empty;  // ApplicationNumber
        public string  EntityType   { get; set; } = string.Empty;  // "LOAN"
        public int     Sequence     { get; set; }
        public string  Label        { get; set; } = string.Empty;
        public string  RequiredRole { get; set; } = string.Empty;
        /// <summary>PENDING | APPROVED | REJECTED | SKIPPED</summary>
        public string  Status       { get; set; } = "PENDING";
        public string? PerformedBy  { get; set; }
        public string? Comments     { get; set; }
        public DateTime  CreatedAt  { get; set; } = DateTime.UtcNow;
        public DateTime? ActionedAt { get; set; }
    }
}

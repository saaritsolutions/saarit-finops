namespace WorkflowOrchestrationService.Models
{
    /// <summary>
    /// Configures which approval levels are required for a given workflow type and amount band.
    /// Seeded at startup; one row per level per workflowType.
    /// </summary>
    public class ApprovalLevel
    {
        public int    Id           { get; set; }
        public string WorkflowType { get; set; } = string.Empty;  // "LOAN_ORIGINATION"
        public decimal AmountMin   { get; set; }
        public decimal AmountMax   { get; set; }   // decimal.MaxValue = unbounded
        public int    Sequence     { get; set; }   // 1, 2, 3 …
        public string Label        { get; set; } = string.Empty;  // "Branch Manager"
        public string RequiredRole { get; set; } = string.Empty;  // "CHECKER" | "MANAGER" | "BOARD"
        public int    TimeoutHours { get; set; } = 48;
    }
}

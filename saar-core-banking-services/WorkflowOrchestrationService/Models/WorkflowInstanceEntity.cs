using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WorkflowOrchestrationService.Models
{
    /// <summary>EF Core entity for persisting workflow instances to PostgreSQL.</summary>
    public class WorkflowInstanceEntity
    {
        [Key]
        public Guid Id { get; set; }

        [MaxLength(100)]
        public string WorkflowType { get; set; } = string.Empty;

        /// <summary>Foreign key to the business entity (loan application ID, account ID, etc.)</summary>
        public Guid EntityId { get; set; }

        [MaxLength(50)]
        public string EntityType { get; set; } = string.Empty;

        [MaxLength(100)]
        public string CurrentStep { get; set; } = string.Empty;

        /// <summary>ACTIVE | COMPLETED | ERROR | PENDING</summary>
        [MaxLength(50)]
        public string Status { get; set; } = string.Empty;

        /// <summary>JSON-serialized Dictionary&lt;string, object&gt;</summary>
        [Column(TypeName = "text")]
        public string? ContextJson { get; set; }

        /// <summary>JSON-serialized List&lt;ApprovalRequirement&gt;</summary>
        [Column(TypeName = "text")]
        public string? ApprovalRequirementsJson { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
    }
}

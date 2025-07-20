using Microsoft.EntityFrameworkCore;

namespace DocumentManagementService.Models
{
    public class Document
    {
        public int Id { get; set; }
        public string DocumentType { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
        public int CustomerId { get; set; }
        public string? KycType { get; set; }
    }

    public class DocumentDbContext : DbContext
    {
        public DocumentDbContext(DbContextOptions<DocumentDbContext> options) : base(options) { }

        public DbSet<Document> Documents { get; set; }
    }
}

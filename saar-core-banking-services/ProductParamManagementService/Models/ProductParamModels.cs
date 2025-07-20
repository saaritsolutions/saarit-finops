using Microsoft.EntityFrameworkCore;

namespace ProductParamManagementService.Models
{
    public class Product
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public ICollection<ProductParameter> Parameters { get; set; } = new List<ProductParameter>();
    }

    public class ProductParameter
    {
        public int Id { get; set; }
        public int ProductId { get; set; }
        public Product Product { get; set; } = null!;
        public string Key { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }

    public class ProductParamDbContext : DbContext
    {
        public ProductParamDbContext(DbContextOptions<ProductParamDbContext> options) : base(options) { }

        public DbSet<Product> Products { get; set; }
        public DbSet<ProductParameter> ProductParameters { get; set; }
    }
}

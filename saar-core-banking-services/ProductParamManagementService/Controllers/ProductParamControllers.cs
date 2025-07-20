using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductParamManagementService.Models;

namespace ProductParamManagementService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductsController : ControllerBase
    {
        private readonly ProductParamDbContext _context;
        public ProductsController(ProductParamDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Product>>> GetProducts()
        {
            return await _context.Products.Include(p => p.Parameters).ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Product>> GetProduct(int id)
        {
            var product = await _context.Products.Include(p => p.Parameters).FirstOrDefaultAsync(p => p.Id == id);
            if (product == null) return NotFound();
            return product;
        }

        [HttpPost]
        public async Task<ActionResult<Product>> CreateProduct(Product product)
        {
            _context.Products.Add(product);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, product);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateProduct(int id, Product product)
        {
            if (id != product.Id) return BadRequest();
            _context.Entry(product).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteProduct(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null) return NotFound();
            _context.Products.Remove(product);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class ProductParametersController : ControllerBase
    {
        private readonly ProductParamDbContext _context;
        public ProductParametersController(ProductParamDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProductParameter>>> GetParameters()
        {
            return await _context.ProductParameters.Include(p => p.Product).ToListAsync();
        }

        [HttpPost]
        public async Task<ActionResult<ProductParameter>> CreateParameter(ProductParameter parameter)
        {
            _context.ProductParameters.Add(parameter);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetParameters), new { id = parameter.Id }, parameter);
        }
    }
}

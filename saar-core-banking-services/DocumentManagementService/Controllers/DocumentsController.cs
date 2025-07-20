using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DocumentManagementService.Models;

namespace DocumentManagementService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentsController : ControllerBase
    {
        private readonly DocumentDbContext _context;
        public DocumentsController(DocumentDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Document>>> GetDocuments()
        {
            return await _context.Documents.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Document>> GetDocument(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();
            return doc;
        }

        [HttpPost]
        public async Task<ActionResult<Document>> CreateDocument(Document doc)
        {
            _context.Documents.Add(doc);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetDocument), new { id = doc.Id }, doc);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDocument(int id, Document doc)
        {
            if (id != doc.Id) return BadRequest();
            _context.Entry(doc).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDocument(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound();
            _context.Documents.Remove(doc);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}

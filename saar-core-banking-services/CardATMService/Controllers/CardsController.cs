using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CardATMService.Models;

namespace CardATMService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CardsController : ControllerBase
    {
        private readonly CardATMDBContext _context;
        public CardsController(CardATMDBContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Card>>> GetCards()
        {
            return await _context.Cards.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Card>> GetCard(int id)
        {
            var card = await _context.Cards.FindAsync(id);
            if (card == null) return NotFound();
            return card;
        }

        [HttpPost]
        public async Task<ActionResult<Card>> CreateCard(Card card)
        {
            _context.Cards.Add(card);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetCard), new { id = card.Id }, card);
        }
    }
}

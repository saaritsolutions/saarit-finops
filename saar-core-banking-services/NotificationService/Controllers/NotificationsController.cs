using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotificationService.Models;

namespace NotificationService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationsController : ControllerBase
    {
        private readonly NotificationDbContext _context;
        public NotificationsController(NotificationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Notification>>> GetNotifications()
        {
            return await _context.Notifications.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Notification>> GetNotification(int id)
        {
            var notification = await _context.Notifications.FindAsync(id);
            if (notification == null) return NotFound();
            return notification;
        }

        [HttpPost]
        public async Task<ActionResult<Notification>> CreateNotification(Notification notification)
        {
            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetNotification), new { id = notification.Id }, notification);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateNotification(int id, Notification notification)
        {
            if (id != notification.Id) return BadRequest();
            _context.Entry(notification).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteNotification(int id)
        {
            var notification = await _context.Notifications.FindAsync(id);
            if (notification == null) return NotFound();
            _context.Notifications.Remove(notification);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}

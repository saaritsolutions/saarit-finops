using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using UserAccessManagementService.Models;

namespace UserAccessManagementService.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly UserAccessDbContext _context;
        private readonly IConfiguration _config;

        public AuthController(UserAccessDbContext context, IConfiguration config)
        {
            _context = context;
            _config  = config;
        }

        /// <summary>POST /api/auth/login — returns JWT on valid credentials.</summary>
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest(new { message = "Username and password are required." });

            var user = await _context.Users
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Email == request.Username || u.Username == request.Username);

            if (user == null || !user.IsActive ||
                !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return Unauthorized(new { message = "Invalid credentials." });
            }

            var roles = user.UserRoles.Select(ur => ur.Role.Name).ToArray();
            var token = GenerateJwt(user, roles);

            // Derive a friendly first name from the email prefix (e.g. "admin" from "admin@…")
            var firstName = user.Email.Split('@')[0];
            firstName = char.ToUpper(firstName[0]) + firstName[1..];

            return Ok(new
            {
                token,
                expiry = DateTime.UtcNow.AddHours(8),
                user   = new
                {
                    id        = user.Id.ToString(),
                    userId    = $"user{user.Id:D3}",
                    username  = user.Username,
                    email     = user.Email,
                    firstName,
                    lastName  = "User",
                    roles,
                    isActive  = user.IsActive,
                },
            });
        }

        // ── JWT helper ────────────────────────────────────────────────────────

        private string GenerateJwt(User user, string[] roles)
        {
            var secret   = _config["Jwt:Secret"]   ?? "SaarCoreBankingJwtSecret2026DemoKeyLongEnoughForHS256";
            var issuer   = _config["Jwt:Issuer"]   ?? "saar-banking";
            var audience = _config["Jwt:Audience"] ?? "saar-banking-clients";

            var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
                new(JwtRegisteredClaimNames.Email, user.Email),
                new(JwtRegisteredClaimNames.Name,  user.Username),
                new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            };
            foreach (var role in roles)
                claims.Add(new Claim(ClaimTypes.Role, role));

            var token = new JwtSecurityToken(
                issuer:             issuer,
                audience:           audience,
                claims:             claims,
                expires:            DateTime.UtcNow.AddHours(8),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }

    public record LoginRequest(string Username, string Password);
}

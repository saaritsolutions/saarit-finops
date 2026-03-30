using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using UserAccessManagementService.Models;

var builder = WebApplication.CreateBuilder(args);

// ── JWT ──────────────────────────────────────────────────────────────────────
var jwtSecret   = builder.Configuration["Jwt:Secret"]   ?? "SaarCoreBankingJwtSecret2026DemoKeyLongEnoughForHS256";
var jwtIssuer   = builder.Configuration["Jwt:Issuer"]   ?? "saar-banking";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "saar-banking-clients";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = jwtIssuer,
            ValidAudience            = jwtAudience,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        };
    });

builder.Services.AddAuthorization();

// ── Database ─────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<UserAccessDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── CORS ─────────────────────────────────────────────────────────────────────
var configuredOrigins = (builder.Configuration["CORS__AllowedOrigins"]
                       ?? builder.Configuration["CORS:AllowedOrigins"]
                       ?? "")
    .Split(';', StringSplitOptions.RemoveEmptyEntries);

var allowedOrigins = new List<string>
{
    "http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
    "http://localhost:5173", "http://localhost:5174",
};
allowedOrigins.AddRange(configuredOrigins);

builder.Services.AddCors(opts =>
{
    opts.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins.ToArray())
              .AllowAnyMethod()
              .AllowAnyHeader());
});

// ── MVC + Swagger ─────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(opts =>
{
    opts.SwaggerDoc("v1", new OpenApiInfo { Title = "UserAccess API", Version = "v1" });
    opts.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name        = "Authorization",
        Type        = SecuritySchemeType.ApiKey,
        In          = ParameterLocation.Header,
        Scheme      = "Bearer",
        Description = "Enter: Bearer {your-jwt-token}",
    });
    opts.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// ── Migrations + Demo seed ────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<UserAccessDbContext>();
    db.Database.Migrate();
    await SeedDemoData(db);
}

// ── Middleware pipeline ───────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();

// ── Demo data seeder ──────────────────────────────────────────────────────────

async Task SeedDemoData(UserAccessDbContext db)
{
    // Seed roles
    foreach (var roleName in new[] { "Admin", "Maker", "Checker" })
    {
        if (!db.Roles.Any(r => r.Name == roleName))
            db.Roles.Add(new Role { Name = roleName });
    }
    await db.SaveChangesAsync();

    var adminRole   = db.Roles.First(r => r.Name == "Admin");
    var makerRole   = db.Roles.First(r => r.Name == "Maker");
    var checkerRole = db.Roles.First(r => r.Name == "Checker");

    // Seed users (idempotent by email)
    await EnsureUser(db, "admin@saarbanking.com",   "admin123",   adminRole);
    await EnsureUser(db, "maker@saarbanking.com",   "maker123",   makerRole);
    await EnsureUser(db, "checker@saarbanking.com", "checker123", checkerRole);
}

async Task EnsureUser(UserAccessDbContext db, string email, string password, Role role)
{
    if (db.Users.Any(u => u.Email == email))
        return;

    var user = new User
    {
        Username     = email,
        Email        = email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
        IsActive     = true,
    };
    db.Users.Add(user);
    await db.SaveChangesAsync();

    db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
    await db.SaveChangesAsync();
}

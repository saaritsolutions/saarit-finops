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
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
        opts.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);
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
    await SeedTenants(db);
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

async Task SeedTenants(UserAccessDbContext db)
{
    var tenants = new[]
    {
        new Tenant { Id = "public",    Name = "System Default",       ThemeColor = null,      CreatedAt = DateTime.UtcNow },
        new Tenant { Id = "ucb_demo",  Name = "UCB Cooperative Bank", ThemeColor = "#1565C0", CreatedAt = DateTime.UtcNow },
        new Tenant { Id = "nbfc_demo", Name = "SaaR NBFC",            ThemeColor = "#2E7D32", CreatedAt = DateTime.UtcNow },
    };
    foreach (var t in tenants)
    {
        if (!db.Tenants.Any(x => x.Id == t.Id))
            db.Tenants.Add(t);
    }
    await db.SaveChangesAsync();
}

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

    // Default (public) tenant users
    await EnsureUser(db, "admin@saarbanking.com",   "admin123",   adminRole,   "public");
    await EnsureUser(db, "maker@saarbanking.com",   "maker123",   makerRole,   "public");
    await EnsureUser(db, "checker@saarbanking.com", "checker123", checkerRole, "public");

    // UCB demo tenant users
    await EnsureUser(db, "admin@ucb-demo.com",  "ucb123",  adminRole, "ucb_demo");
    await EnsureUser(db, "maker@ucb-demo.com",  "ucb123",  makerRole, "ucb_demo");

    // NBFC demo tenant users
    await EnsureUser(db, "admin@nbfc-demo.com", "nbfc123", adminRole, "nbfc_demo");
    await EnsureUser(db, "maker@nbfc-demo.com", "nbfc123", makerRole, "nbfc_demo");
}

async Task EnsureUser(UserAccessDbContext db, string email, string password, Role role, string tenantId = "public")
{
    if (db.Users.Any(u => u.Email == email))
        return;

    var user = new User
    {
        Username     = email,
        Email        = email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
        IsActive     = true,
        TenantId     = tenantId,
    };
    db.Users.Add(user);
    await db.SaveChangesAsync();

    db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
    await db.SaveChangesAsync();
}

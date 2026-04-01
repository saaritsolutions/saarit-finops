using Microsoft.EntityFrameworkCore;
using AccountService.Data;
using AccountService.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
        opts.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add PostgreSQL DbContext
builder.Services.AddDbContext<AccountDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// CORS — local dev origins + any extra domain from CORS:AllowedOrigins env var
// In docker-compose: CORS__AllowedOrigins=https://demobank.saaritsolutions.com
var extraCorsOrigins = (builder.Configuration["CORS:AllowedOrigins"] ?? "")
    .Split(';', StringSplitOptions.RemoveEmptyEntries);
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var origins = new List<string>
        {
            "http://localhost:3000", "http://127.0.0.1:3000",
            "http://localhost:3001", "http://127.0.0.1:3001",
            "http://localhost:3002", "http://127.0.0.1:3002",
            "http://localhost:5173", "http://127.0.0.1:5173"
        };
        origins.AddRange(extraCorsOrigins);
        policy.WithOrigins(origins.ToArray()).AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

// Apply migrations on startup; if schema is out-of-date (missing tables from model
// changes after InitialCreate), drop and recreate. Acceptable for demo environment.
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AccountDbContext>();
    try
    {
        context.Database.Migrate();
        // Probe for a table that wasn't in InitialCreate — if it doesn't exist, schema is stale
        _ = context.AccountProductTypes.Count();
    }
    catch
    {
        // Schema is stale or tables are missing — wipe and recreate from current EF model
        context.Database.EnsureDeleted();
        context.Database.EnsureCreated();
    }
    await SeedProductTypes(context);
}

async Task SeedProductTypes(AccountDbContext db)
{
    if (db.AccountProductTypes.Any()) return;
    var products = new[]
    {
        new AccountProductType { Name = "Savings",  Description = "Standard savings account", MinimumOpeningAmount = 500,   IsActive = true },
        new AccountProductType { Name = "Current",  Description = "Current/OD account",        MinimumOpeningAmount = 5000,  IsActive = true },
        new AccountProductType { Name = "FD",       Description = "Fixed deposit",              MinimumOpeningAmount = 1000,  IsActive = true },
        new AccountProductType { Name = "RD",       Description = "Recurring deposit",          MinimumOpeningAmount = 500,   IsActive = true },
        new AccountProductType { Name = "NRE",      Description = "Non-resident external",      MinimumOpeningAmount = 10000, IsActive = true },
        new AccountProductType { Name = "NRO",      Description = "Non-resident ordinary",      MinimumOpeningAmount = 10000, IsActive = true },
    };
    db.AccountProductTypes.AddRange(products);
    await db.SaveChangesAsync();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseAuthorization();
app.MapControllers();

app.Run();
// Test comment to trigger CI/CD workflow - Sun Jul 20 15:53:17 IST 2025
Console.WriteLine("CI/CD Pipeline Test - Sun Jul 20 23:02:06 IST 2025"); // Trigger workflow

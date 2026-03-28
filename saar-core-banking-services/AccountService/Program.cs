using Microsoft.EntityFrameworkCore;
using AccountService.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
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

// Apply migrations on startup for CI environment
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AccountDbContext>();
    context.Database.Migrate();
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

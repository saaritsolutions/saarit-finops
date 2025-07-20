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

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthorization();
app.MapControllers();

app.Run();
// Test comment to trigger CI/CD workflow - Sun Jul 20 15:53:17 IST 2025
Console.WriteLine("CI/CD Pipeline Test - Sun Jul 20 23:02:06 IST 2025"); // Trigger workflow

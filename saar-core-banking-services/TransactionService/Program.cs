using Microsoft.EntityFrameworkCore;
using TransactionService.Data;
using TransactionService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title   = "Transaction Service",
        Version = "v1",
        Description = "Double-entry ledger: post journals, query GL account balances, and evaluate transaction rules.",
    });
});

// ── Database: in-memory fallback for dev demos ───────────────────────────────
var useInMemory = Environment.GetEnvironmentVariable("TXN_USE_INMEMORY_DB");
if (!string.IsNullOrWhiteSpace(useInMemory) &&
    (useInMemory == "1" || string.Equals(useInMemory, "true", StringComparison.OrdinalIgnoreCase)))
{
    builder.Services.AddDbContext<TransactionDbContext>(o =>
        o.UseInMemoryDatabase("TransactionServiceDev"));
    Console.WriteLine("[TransactionService] Using InMemory database (TXN_USE_INMEMORY_DB={0})", useInMemory);
}
else
{
    var cs = builder.Configuration.GetConnectionString("DefaultConnection")
             ?? "Host=localhost;Database=saar_banking_transactions;Username=postgres;Password=postgres";
    builder.Services.AddDbContext<TransactionDbContext>(o => o.UseNpgsql(cs));
}

// ── Application services ─────────────────────────────────────────────────────
builder.Services.AddScoped<IPostingEngine, PostingEngine>();
builder.Services.AddScoped<ILedgerService, LedgerService>();
builder.Services.AddScoped<ITransactionRuleEvaluationService, TransactionRuleEvaluationService>();
builder.Services.AddScoped<LedgerSeedService>();
builder.Services.AddHttpClient();

// ── CORS — allow React frontend on all local ports in dev ────────────────────
builder.Services.AddCors(options =>
{
    if (builder.Environment.IsDevelopment())
    {
        options.AddPolicy("ReactFrontend", policy =>
            policy.SetIsOriginAllowed(_ => true)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials());
    }
    else
    {
        options.AddPolicy("ReactFrontend", policy =>
            policy.WithOrigins(
                "http://localhost:3000", "https://localhost:3000",
                "http://localhost:3001", "https://localhost:3001",
                "http://localhost:3002", "https://localhost:3002",
                "http://127.0.0.1:3000", "https://127.0.0.1:3000")
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials());
    }
});

var app = builder.Build();

// ── Swagger always enabled (needed for demo) ─────────────────────────────────
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Transaction Service v1");
    c.RoutePrefix = "swagger";
});

// app.UseHttpsRedirection();   // disabled for local HTTP demo
app.UseCors("ReactFrontend");
app.UseAuthorization();
app.MapControllers();

// ── Health endpoint ──────────────────────────────────────────────────────────
app.MapGet("/health", () => Results.Json(new { status = "ok", service = "TransactionService" }));

// ── Startup: ensure DB + seed chart of accounts ──────────────────────────────
using var scope = app.Services.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<TransactionDbContext>();
try
{
    await db.Database.EnsureCreatedAsync();
    var seed = scope.ServiceProvider.GetRequiredService<LedgerSeedService>();
    await seed.SeedAsync();
}
catch (Exception ex)
{
    Console.WriteLine("[TransactionService] DB init/seed failed (non-fatal): {0}", ex.Message);
}

app.Run();

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using TransactionService.Data;
using TransactionService.Services;
using TransactionService.Middleware;

var builder = WebApplication.CreateBuilder(args);

// ── JWT (read tenant_id claim — same config as UAM) ───────────────────────────
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

// ── Multi-tenancy ─────────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantService, HttpContextTenantService>();

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);
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

// Named HttpClient for ExpressionBuilderService (used by PostingEngine + TransactionRuleEvaluationService)
var exprUrl = builder.Configuration["Services:ExpressionBaseUrl"] ?? "http://localhost:5004";
builder.Services.AddHttpClient("ExpressionBuilder", client =>
{
    client.BaseAddress = new Uri(exprUrl.EndsWith('/') ? exprUrl : exprUrl + "/");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
    client.Timeout = TimeSpan.FromSeconds(5); // fail fast — expression engine is non-critical
});
builder.Services.AddHttpClient(); // anonymous client for any other inter-service calls

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
app.UseAuthentication();
app.UseAuthorization();
app.UseTenantResolution();
app.MapControllers();

// ── Health endpoint ──────────────────────────────────────────────────────────
app.MapGet("/health", () => Results.Json(new { status = "ok", service = "TransactionService" }));

// ── Startup: provision tenant schemas + seed chart of accounts ───────────────
using var scope = app.Services.CreateScope();
try
{
    await TenantSchemaProvisioner.ProvisionAllSchemasAsync(scope.ServiceProvider);
    // Seed chart of accounts in each tenant schema
    var txnOptions = scope.ServiceProvider.GetRequiredService<Microsoft.EntityFrameworkCore.DbContextOptions<TransactionDbContext>>();
    var loggerFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();
    foreach (var tenantId in new[] { "public", "ucb_demo", "nbfc_demo" })
    {
        using var tenantCtx = new TransactionDbContext(txnOptions, new StaticTenantService(tenantId));
        var seedLogger = loggerFactory.CreateLogger<LedgerSeedService>();
        var seed = new LedgerSeedService(tenantCtx, seedLogger);
        await seed.SeedAsync();
    }
}
catch (Exception ex)
{
    Console.WriteLine("[TransactionService] DB init/seed failed (non-fatal): {0}", ex.Message);
}

app.Run();

// Required by WebApplicationFactory<Program> in integration test projects
public partial class Program { }

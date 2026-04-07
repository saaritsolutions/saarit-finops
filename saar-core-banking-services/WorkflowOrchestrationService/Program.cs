using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using WorkflowOrchestrationService.Controllers;
using WorkflowOrchestrationService.Data;
using WorkflowOrchestrationService.Middleware;
using WorkflowOrchestrationService.Services;

var builder = WebApplication.CreateBuilder(args);

// ── JWT (same secret/issuer/audience as UAM — needed to read tenant_id claim) ─
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

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── Multi-tenancy ─────────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantService, HttpContextTenantService>();

// ── PostgreSQL DbContext ───────────────────────────────────────────────────────
builder.Services.AddDbContext<WorkflowDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Workflow rule service (scoped — shares DbContext lifetime) ────────────────
builder.Services.AddScoped<IWorkflowRuleService, WorkflowRuleService>();

// ── HttpClient for ExpressionBuilderService ───────────────────────────────────
var exprBaseUrl = builder.Configuration.GetSection("Services").GetValue<string>("ExpressionBaseUrl") ?? "http://localhost:5004";
builder.Services.AddHttpClient("ExpressionBuilder", client =>
{
    client.BaseAddress = new Uri(exprBaseUrl);
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

// ── CORS ──────────────────────────────────────────────────────────────────────
var extraCorsOrigins = (builder.Configuration["CORS:AllowedOrigins"] ?? "")
    .Split(';', StringSplitOptions.RemoveEmptyEntries);

const string CorsPolicy = "AllowLocalDev";
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
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

// ── Startup: provision tenant schemas ────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    await TenantSchemaProvisioner.ProvisionAllSchemasAsync(scope.ServiceProvider);
}

// Enable Swagger in all environments for demos/testing
app.UseSwagger();
app.UseSwaggerUI();

app.UseRouting();
app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.UseTenantResolution();
app.MapControllers();

app.Run();

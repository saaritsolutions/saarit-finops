using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using AccountService.Data;
using AccountService.Models;
using AccountService.Services;
using AccountService.Middleware;

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

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
        opts.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── Multi-tenancy ─────────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantService, HttpContextTenantService>();

// ── External service HTTP clients ────────────────────────────────────────────
var exprBase     = builder.Configuration["Services:ExpressionBaseUrl"]   ?? "http://localhost:5004";
var wfBase       = builder.Configuration["Services:WorkflowBaseUrl"]     ?? "http://localhost:5012";
var dynFormsBase = builder.Configuration["Services:DynamicFormsBaseUrl"] ?? "http://localhost:5013";

builder.Services.AddHttpClient<IExpressionEvaluationService, ExpressionEvaluationService>(c =>
    c.BaseAddress = new Uri(exprBase));
builder.Services.AddHttpClient<IWorkflowClient, WorkflowClient>(c =>
    c.BaseAddress = new Uri(wfBase));
builder.Services.AddHttpClient<IDynamicFormsClient, DynamicFormsClient>(c =>
    c.BaseAddress = new Uri(dynFormsBase));

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

// ── Startup: provision tenant schemas + seed data ────────────────────────────
using (var scope = app.Services.CreateScope())
{
    await TenantSchemaProvisioner.ProvisionAllSchemasAsync(scope.ServiceProvider);
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseTenantResolution();
app.MapControllers();

app.Run();
// Test comment to trigger CI/CD workflow - Sun Jul 20 15:53:17 IST 2025
Console.WriteLine("CI/CD Pipeline Test - Sun Jul 20 23:02:06 IST 2025"); // Trigger workflow

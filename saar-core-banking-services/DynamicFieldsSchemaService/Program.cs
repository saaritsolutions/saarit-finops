using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using DynamicFieldsSchemaService.Data;
using DynamicFieldsSchemaService.Middleware;
using DynamicFieldsSchemaService.Services;

var builder = WebApplication.CreateBuilder(args);

// ── JWT ───────────────────────────────────────────────────────────────────────
var jwtSecret   = builder.Configuration["Jwt:Secret"]   ?? "SaarCoreBankingJwtSecret2026DemoKeyLongEnoughForHS256";
var jwtIssuer   = builder.Configuration["Jwt:Issuer"]   ?? "saar-banking";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "saar-banking-clients";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts => opts.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer           = true,
        ValidateAudience         = true,
        ValidateLifetime         = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer              = jwtIssuer,
        ValidAudience            = jwtAudience,
        IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
    });

// ── Controllers + JSON ────────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── Multi-tenancy ─────────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantService, HttpContextTenantService>();

// ── Database ──────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<DynamicFormsDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Seed service ──────────────────────────────────────────────────────────────
builder.Services.AddHostedService<FormSchemaSeedService>();

// ── CORS ──────────────────────────────────────────────────────────────────────
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

// ── Startup: provision tenant schemas ────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    await TenantSchemaProvisioner.ProvisionAllSchemasAsync(scope.ServiceProvider);
}

// ── Middleware pipeline ───────────────────────────────────────────────────────
app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseTenantResolution();
app.MapControllers();

app.Run();

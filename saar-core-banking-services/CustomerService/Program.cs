using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using CustomerService.Data;
using CustomerService.Services;
using CustomerService.Middleware;

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

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── Multi-tenancy ─────────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantService, HttpContextTenantService>();

// Configure PostgreSQL DbContext
builder.Services.AddDbContext<CustomerDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Enable CORS for all origins, headers, and methods
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// ── Startup: provision tenant schemas + seed demo data ───────────────────────
using (var scope = app.Services.CreateScope())
{
    await TenantSchemaProvisioner.ProvisionAllSchemasAsync(scope.ServiceProvider);

    var connStr = app.Configuration.GetConnectionString("DefaultConnection")!;
    foreach (var tenantId in new[] { "public", "ucb_demo", "nbfc_demo" })
    {
        try
        {
            var tenantOpts = new DbContextOptionsBuilder<CustomerDbContext>()
                .UseNpgsql(connStr + $";SearchPath={tenantId}")
                .Options;
            await using var seedDb = new CustomerDbContext(tenantOpts, new StaticTenantService(tenantId));
            await CustomerDemoDataSeeder.SeedAsync(seedDb, tenantId);
            Console.WriteLine("[CustomerService] Demo customers seeded for tenant {0}", tenantId);
        }
        catch (Exception ex)
        {
            Console.WriteLine("[CustomerService] Demo seed skipped for tenant {0}: {1}", tenantId, ex.Message);
        }
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.UseTenantResolution();
app.MapControllers();

app.Run();
// Security scan fix test - Mon Jul 21 17:57:13 IST 2025

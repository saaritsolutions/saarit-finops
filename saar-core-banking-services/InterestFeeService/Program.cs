using InterestFeeService.Data;
using InterestFeeService.Jobs;
using InterestFeeService.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ── Database ─────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<InterestFeeDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── HTTP clients for downstream services ─────────────────────────────────────
var accBase = builder.Configuration["Services:AccountBaseUrl"]     ?? "http://localhost:5217";
var txnBase = builder.Configuration["Services:TransactionBaseUrl"] ?? "http://localhost:5005";

builder.Services.AddHttpClient<IAccountServiceClient, AccountServiceClient>(c =>
    c.BaseAddress = new Uri(accBase));
builder.Services.AddHttpClient<ITransactionPostingClient, TransactionPostingClient>(c =>
    c.BaseAddress = new Uri(txnBase));

// ── Background job: register as both singleton (for DI into controller)
//    and as a hosted service ──────────────────────────────────────────────────
builder.Services.AddSingleton<DailyAccrualJob>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<DailyAccrualJob>());

// ── Controllers + Swagger ─────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── CORS ──────────────────────────────────────────────────────────────────────
var allowedOrigins = builder.Configuration["CORS:AllowedOrigins"]?.Split(',') ??
                     new[] { "http://localhost:3002" };
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()));

var app = builder.Build();

// ── Auto-migrate DB on startup (single schema — no TenantSchemaProvisioner) ──
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<InterestFeeDbContext>();
    db.Database.Migrate();
}

// ── Middleware ────────────────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.MapControllers();
app.Run();

using ExpressionBuilderService.Data;
using ExpressionBuilderService.Engine;
using ExpressionBuilderService.Security;
using ExpressionBuilderService.Services;
using ExpressionBuilderService.Functions;
using ExpressionBuilderService.AI;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/expressionbuilder-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Swagger configuration
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Expression Builder Service",
        Version = "v1",
        Description = "A service for building, compiling, and executing banking business rules using C# expressions with Roslyn",
        Contact = new OpenApiContact
        {
            Name = "SaaR Solutions",
            Email = "support@saarsolutions.com"
        }
    });

    // Include XML comments
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    c.IncludeXmlComments(xmlPath);

    // Add JWT Bearer authorization
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Database configuration with optional in-memory fallback for local/dev
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Database=saar_banking_expressions;Username=postgres;Password=postgres";

var useInMemoryDb = Environment.GetEnvironmentVariable("EXPR_USE_INMEMORY_DB");
if (!string.IsNullOrWhiteSpace(useInMemoryDb) &&
    (string.Equals(useInMemoryDb, "1", StringComparison.OrdinalIgnoreCase) ||
     string.Equals(useInMemoryDb, "true", StringComparison.OrdinalIgnoreCase)))
{
    builder.Services.AddDbContext<ExpressionDbContext>(options =>
        options.UseInMemoryDatabase("ExpressionBuilderDev"));
    Log.Warning("Using InMemory database for ExpressionBuilderService (EXPR_USE_INMEMORY_DB={UseInMemoryDb})", useInMemoryDb);
}
else
{
    builder.Services.AddDbContext<ExpressionDbContext>(options =>
        options.UseNpgsql(connectionString));
}

// Memory caching
builder.Services.AddMemoryCache();

// Expression Engine services
builder.Services.AddScoped<IBankingFunctionLibrary, BankingFunctionLibrary>();
builder.Services.AddScoped<ISecurityValidator, ExpressionSecurityValidator>();
builder.Services.AddScoped<IExpressionEngine, RoslynExpressionEngine>();
builder.Services.AddScoped<IExpressionService, ExpressionService>();

// AI Services Configuration (only OpenAI now)
builder.Services.Configure<OpenAISettings>(
    builder.Configuration.GetSection(OpenAISettings.SectionName));

// LLM configuration (allow selecting provider via configuration)
builder.Services.Configure<LlmSettings>(builder.Configuration.GetSection("LlmSettings"));

// HTTP Client and registration for OpenAI (only provider in use)
builder.Services.AddHttpClient<OpenAIGptService>();
builder.Services.AddScoped<OpenAIGptService>();

// Generic ILLMService selector
builder.Services.AddScoped<ILlmSelectorService, LlmSelectorService>();

// CORS configuration for React frontend
builder.Services.AddCors(options =>
{
    // In development allow all local origins to simplify testing (keeps AllowCredentials).
    // In production/staging keep the explicit allow-list.
    if (builder.Environment.IsDevelopment())
    {
        options.AddPolicy("ReactFrontend", policy =>
        {
            policy
                .SetIsOriginAllowed(origin => true)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        });
    }
    else
    {
        options.AddPolicy("ReactFrontend", policy =>
        {
            policy.WithOrigins(
                    "http://localhost:3000",
                    "https://localhost:3000",
                    "http://localhost:3001",
                    "https://localhost:3001",
                    "http://localhost:3002",
                    "https://localhost:3002",
                    "http://127.0.0.1:3000",
                    "https://127.0.0.1:3000",
                    "http://127.0.0.1:3001",
                    "https://127.0.0.1:3001",
                    "http://127.0.0.1:3002",
                    "https://127.0.0.1:3002",
                    "http://192.168.1.10:3000",
                    "https://192.168.1.10:3000",
                    "http://192.168.1.10:3001",
                    "https://192.168.1.10:3001"
                  )
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
    }
});

// JWT Authentication (placeholder - integrate with your existing auth)
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        // Configure JWT options here
        options.Authority = builder.Configuration["Auth:Authority"];
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters.ValidateAudience = false;
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// Configure the HTTP request pipeline
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Expression Builder Service v1");
    c.RoutePrefix = "swagger"; // Serve Swagger UI at /swagger
});

// Comment out HTTPS redirection for HTTP access
// app.UseHttpsRedirection();
app.UseCors("ReactFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Lightweight health/diagnostics endpoint for LLM configuration
app.MapGet("/health/llm", (IConfiguration config) =>
{
    var provider = config["LlmSettings:DefaultProvider"] ?? "unknown";
    var hasOpenAiKey = !string.IsNullOrWhiteSpace(config["OpenAI:ApiKey"]);
    return Results.Json(new { provider, hasOpenAiKey });
});

// Auto-migrate database on startup (non-fatal if DB not available)
using var scope = app.Services.CreateScope();
var context = scope.ServiceProvider.GetRequiredService<ExpressionDbContext>();
try
{
    await context.Database.EnsureCreatedAsync();
}
catch (Exception dbEx)
{
    Log.Warning(dbEx, "Database ensure/create failed. Continuing startup as some endpoints don't require DB.");
}

Log.Information("Expression Builder Service starting up...");

// Check for presence of OpenAI API Key (do not log the key itself)
try
{
    var openAiKey = builder.Configuration["OpenAI:ApiKey"]; // user-secrets or env var
    if (string.IsNullOrWhiteSpace(openAiKey))
    {
        Log.Warning("OpenAI:ApiKey not configured. Calls to OpenAI provider will fail with 401/403. Set via 'dotnet user-secrets set OpenAI:ApiKey <key>' or environment variable.");
    }
    else
    {
        Log.Information("OpenAI:ApiKey detected (length={Length}).", openAiKey.Length);
    }
}
catch (Exception ex)
{
    Log.Error(ex, "Error while checking OpenAI API key presence.");
}

// Honor hosting configuration/args (ASPNETCORE_URLS, --urls, etc.)
app.Run();

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

// Database configuration
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=localhost;Database=saar_banking_expressions;Username=postgres;Password=postgres";

builder.Services.AddDbContext<ExpressionDbContext>(options =>
    options.UseNpgsql(connectionString));

// Memory caching
builder.Services.AddMemoryCache();

// Expression Engine services
builder.Services.AddScoped<IBankingFunctionLibrary, BankingFunctionLibrary>();
builder.Services.AddScoped<ISecurityValidator, ExpressionSecurityValidator>();
builder.Services.AddScoped<IExpressionEngine, RoslynExpressionEngine>();
builder.Services.AddScoped<IExpressionService, ExpressionService>();

// AI Services Configuration
builder.Services.Configure<GeminiAISettings>(
    builder.Configuration.GetSection(GeminiAISettings.SectionName));

// HTTP Client for Gemini AI
builder.Services.AddHttpClient<IGeminiAIService, GeminiAIService>();
builder.Services.AddScoped<IGeminiAIService, GeminiAIService>();

// CORS configuration for React frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000", 
                "https://localhost:3000", 
                "http://localhost:3001", 
                "https://localhost:3001",
                "http://192.168.1.10:3000",
                "https://192.168.1.10:3000",
                "http://192.168.1.10:3001",
                "https://192.168.1.10:3001"
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
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

// Auto-migrate database on startup
using var scope = app.Services.CreateScope();
var context = scope.ServiceProvider.GetRequiredService<ExpressionDbContext>();
await context.Database.EnsureCreatedAsync();

Log.Information("Expression Builder Service starting up...");

app.Run("http://localhost:5001");

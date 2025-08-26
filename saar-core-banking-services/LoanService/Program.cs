using LoanService.Data;
using LoanService.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS for local dev (Vite @ 5173)
const string CorsPolicy = "AllowLocalDev";
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
    {
    policy.WithOrigins(
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002"
        )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// Local file-based workflow orchestrator for demos
builder.Services.AddScoped<IWorkflowOrchestrator, FileWorkflowOrchestrator>();
builder.Services.AddScoped<NullWorkflowOrchestrator>();

// Register HttpClient for Expression Builder Service (read from config)
var exprBaseUrl = builder.Configuration.GetSection("Services").GetValue<string>("ExpressionBaseUrl") ?? "http://localhost:5004";
builder.Services.AddHttpClient<IExpressionEvaluationService, ExpressionEvaluationService>(client =>
{
    client.BaseAddress = new Uri(exprBaseUrl.EndsWith('/') ? exprBaseUrl : exprBaseUrl + "/");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

// Register Expression Evaluation Service
// Note: Do not add a separate scoped registration here; the typed HttpClient above
// already wires up IExpressionEvaluationService with a configured HttpClient.

// Register HttpClient for Workflow Orchestration Service
builder.Services.AddHttpClient<IWorkflowClient, WorkflowClient>(client =>
{
    client.BaseAddress = new Uri("http://localhost:5012/");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

// Register HttpClient for Dynamic Fields/Forms Service
builder.Services.AddHttpClient<IDynamicFormsClient, DynamicFormsClient>(client =>
{
    client.BaseAddress = new Uri("http://localhost:5013/");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

// Add DbContext (use InMemory for integration tests)
if (builder.Environment.IsEnvironment("IntegrationTesting"))
{
    builder.Services.AddDbContext<LoanDbContext>(options =>
        options.UseInMemoryDatabase("LoanService_IntTests"));
}
else
{
    builder.Services.AddDbContext<LoanDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
}

var app = builder.Build();

// Enable Swagger in all environments for demos/testing
app.UseSwagger();
app.UseSwaggerUI();

if (!app.Environment.IsEnvironment("IntegrationTesting"))
{
    app.UseHttpsRedirection();
}
app.UseRouting();
app.UseCors(CorsPolicy);
app.UseAuthorization();
app.MapControllers();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast")
.WithOpenApi();

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}

public partial class Program { }

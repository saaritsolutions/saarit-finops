using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using WorkflowOrchestrationService.Controllers;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Register services
builder.Services.AddScoped<IWorkflowRuleService, WorkflowRuleService>();
var exprBaseUrl = builder.Configuration.GetSection("Services").GetValue<string>("ExpressionBaseUrl") ?? "http://localhost:5004";
builder.Services.AddHttpClient("ExpressionBuilder", client =>
{
    client.BaseAddress = new Uri(exprBaseUrl);
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

// CORS — local dev origins + any extra domain from CORS:AllowedOrigins env var
// In docker-compose: CORS__AllowedOrigins=https://demobank.saaritsolutions.com
var extraCorsOrigins = (builder.Configuration["CORS:AllowedOrigins"] ?? "")
    .Split(';', StringSplitOptions.RemoveEmptyEntries);

const string CorsPolicy = "AllowLocalDev";
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
    {
        var origins = new List<string>
        {
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://localhost:3002",
            "http://127.0.0.1:3002",
            "http://localhost:5173",
            "http://127.0.0.1:5173"
        };
        origins.AddRange(extraCorsOrigins);
        policy.WithOrigins(origins.ToArray()).AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

// Enable Swagger in all environments for easier demos/testing
app.UseSwagger();
app.UseSwaggerUI();

app.UseRouting();
app.UseCors(CorsPolicy);
app.UseAuthorization();
app.MapControllers();

app.Run();

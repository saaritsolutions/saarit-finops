using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ExpressionBuilderService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AIWorkflowController : ControllerBase
{
    private readonly ILogger<AIWorkflowController> _logger;

    public AIWorkflowController(ILogger<AIWorkflowController> logger)
    {
        _logger = logger;
    }

    [HttpPost("chat")]
    public IActionResult ChatWorkflow([FromBody] AIWorkflowRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest("Message cannot be empty");

            _logger.LogInformation("Workflow chat request: {Message}", request.Message);

            var options = JsonOptions();
            var wf = ParseWorkflow(request.CurrentWorkflowJson, options);
            if (wf == null)
            {
                // start from a minimal default if none provided
                wf = new WorkflowDefinition
                {
                    WorkflowType = request.WorkflowType ?? "LOAN_ORIGINATION",
                    StartStep = "KYC",
                    Steps = new List<WorkflowStep>
                    {
                        new WorkflowStep { Name = "KYC", Next = "CREDIT_CHECK" },
                        new WorkflowStep { Name = "CREDIT_CHECK", ConditionExpressionId = "EXPR_IS_HIGH_RISK", Next = "UNDERWRITER_REVIEW", ElseNext = "APPROVAL" },
                        new WorkflowStep { Name = "UNDERWRITER_REVIEW", Next = "APPROVAL" },
                        new WorkflowStep { Name = "APPROVAL", Next = "COMPLETED" }
                    }
                };
            }

            var lower = request.Message.ToLowerInvariant();

            // Deterministic helpers for common demo intents
            // Add/Enable KYC step or required action
            if ((lower.Contains("add") || lower.Contains("enable") || lower.Contains("enforce") || lower.Contains("introduce") || lower.Contains("require") || lower.Contains("make"))
                && lower.Contains("kyc"))
            {
                EnsureKycStep(wf);
                if (lower.Contains("verify") || lower.Contains("required action") || lower.Contains("requiredactions") || lower.Contains("action") || lower.Contains("mandatory"))
                {
                    AddRequiredAction(wf, stepName: "KYC", action: "KYC_VERIFY");
                }
            }
            if (lower.Contains("kyc") && (lower.Contains("verify") || lower.Contains("required action") || lower.Contains("requiredactions") || lower.Contains("action")))
            {
                AddRequiredAction(wf, stepName: "KYC", action: "KYC_VERIFY");
            }

            if (lower.Contains("risk") && lower.Contains("assessment"))
            {
                AddStepBefore(wf, newStepName: "RISK_ASSESSMENT", targetStepName: "CREDIT_CHECK");
            }

            if (lower.Contains("senior") && lower.Contains("manager"))
            {
                AddStepBefore(wf, newStepName: "SENIOR_MANAGER_REVIEW", targetStepName: "APPROVAL");
            }

            if (lower.Contains("legal") && lower.Contains("compliance"))
            {
                // Insert before COMPLETED if possible; else before APPROVAL
                var target = wf.Steps.Any(s => string.Equals(s.Name, "COMPLETED", StringComparison.OrdinalIgnoreCase)) ? "COMPLETED" : "APPROVAL";
                AddStepBefore(wf, newStepName: "LEGAL_COMPLIANCE", targetStepName: target);
            }

            if ((lower.Contains("modify") || lower.Contains("rename")) && lower.Contains("credit") && (lower.Contains("analysis") || lower.Contains("enhanced")))
            {
                RenameStep(wf, oldName: "CREDIT_CHECK", newName: "ENHANCED_CREDIT_ANALYSIS");
            }

            // If user asked to remove KYC via common phrasing ("remove kyc check", "disable kyc", etc.)
            if ((lower.Contains("remove") || lower.Contains("delete") || lower.Contains("disable") || lower.Contains("drop"))
                && lower.Contains("kyc"))
            {
                // If it's clearly about a step, or generic "kyc check/verification", remove the KYC step entirely
                if (lower.Contains("step") || lower.Contains("check") || lower.Contains("verification") || lower.Contains("verify"))
                {
                    RemoveStep(wf, "KYC");
                }
                else
                {
                    // Otherwise, remove KYC required actions from KYC step (if step remains)
                    RemoveRequiredAction(wf, stepName: "KYC", action: "KYC_VERIFY");
                }
            }

            // If user asked to remove a step
            var removeIdx = lower.IndexOf("remove step ");
            if (removeIdx >= 0)
            {
                var name = ExtractIdentifier(lower.Substring(removeIdx + "remove step ".Length));
                if (!string.IsNullOrWhiteSpace(name))
                {
                    RemoveStep(wf, name.ToUpperInvariant());
                }
            }

            // Serialize updated workflow definition (JSON-only response for simplicity)
            var json = JsonSerializer.Serialize(wf, new JsonSerializerOptions { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull });
            return Content(json, "application/json");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in Workflow chat");
            return StatusCode(500, new { error = "Error processing workflow chat" });
        }
    }

    private static WorkflowDefinition? ParseWorkflow(string? json, JsonSerializerOptions options)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var wf = JsonSerializer.Deserialize<WorkflowDefinition>(json, options);
            return wf;
        }
        catch
        {
            return null;
        }
    }

    private static JsonSerializerOptions JsonOptions()
    {
        return new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
    }

    private static void AddRequiredAction(WorkflowDefinition wf, string stepName, string action)
    {
        var step = wf.Steps.FirstOrDefault(s => s.Name.Equals(stepName, StringComparison.OrdinalIgnoreCase));
        if (step == null) return;
        step.RequiredActions ??= new List<string>();
        if (!step.RequiredActions.Contains(action)) step.RequiredActions.Add(action);
    }

    private static void AddStepBefore(WorkflowDefinition wf, string newStepName, string targetStepName)
    {
        // If step already exists, do nothing
        if (wf.Steps.Any(s => s.Name.Equals(newStepName, StringComparison.OrdinalIgnoreCase))) return;

        // Create new step pointing to target
        var newStep = new WorkflowStep { Name = newStepName, Next = targetStepName };

        // Try to find a reasonable predecessor to retarget
        // Prefer KYC -> CREDIT_CHECK path; else any step that points to target via Next
        var predecessor = wf.Steps.FirstOrDefault(s => string.Equals(s.Next, targetStepName, StringComparison.OrdinalIgnoreCase))
                         ?? wf.Steps.FirstOrDefault(s => string.Equals(s.ElseNext, targetStepName, StringComparison.OrdinalIgnoreCase));
        if (predecessor != null)
        {
            if (string.Equals(predecessor.Next, targetStepName, StringComparison.OrdinalIgnoreCase))
                predecessor.Next = newStepName;
            if (string.Equals(predecessor.ElseNext, targetStepName, StringComparison.OrdinalIgnoreCase))
                predecessor.ElseNext = newStepName;
        }

        wf.Steps.Add(newStep);
    }

    private static void RenameStep(WorkflowDefinition wf, string oldName, string newName)
    {
        var step = wf.Steps.FirstOrDefault(s => s.Name.Equals(oldName, StringComparison.OrdinalIgnoreCase));
        if (step == null) return;
        // Update references first
        foreach (var s in wf.Steps)
        {
            if (string.Equals(s.Next, oldName, StringComparison.OrdinalIgnoreCase)) s.Next = newName;
            if (string.Equals(s.ElseNext, oldName, StringComparison.OrdinalIgnoreCase)) s.ElseNext = newName;
        }
        step.Name = newName;
    }

    private static void RemoveStep(WorkflowDefinition wf, string name)
    {
        var step = wf.Steps.FirstOrDefault(s => s.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        if (step == null) return;
        // Rewire references to skip this step
        foreach (var s in wf.Steps)
        {
            if (string.Equals(s.Next, step.Name, StringComparison.OrdinalIgnoreCase)) s.Next = step.Next ?? s.Next;
            if (string.Equals(s.ElseNext, step.Name, StringComparison.OrdinalIgnoreCase)) s.ElseNext = step.Next ?? step.ElseNext;
        }
        wf.Steps.Remove(step);
        // If removed was startStep, update startStep
        if (string.Equals(wf.StartStep, step.Name, StringComparison.OrdinalIgnoreCase))
        {
            wf.StartStep = step.Next ?? wf.Steps.FirstOrDefault()?.Name;
        }
    }

    private static void RemoveRequiredAction(WorkflowDefinition wf, string stepName, string action)
    {
        var step = wf.Steps.FirstOrDefault(s => s.Name.Equals(stepName, StringComparison.OrdinalIgnoreCase));
        if (step?.RequiredActions == null || step.RequiredActions.Count == 0) return;
        step.RequiredActions.RemoveAll(a => string.Equals(a, action, StringComparison.OrdinalIgnoreCase) || a.Contains("KYC", StringComparison.OrdinalIgnoreCase));
        if (step.RequiredActions.Count == 0)
        {
            step.RequiredActions = null; // clean up empty list
        }
    }

    private static void EnsureKycStep(WorkflowDefinition wf)
    {
        var existing = wf.Steps.FirstOrDefault(s => s.Name.Equals("KYC", StringComparison.OrdinalIgnoreCase));
        if (existing != null)
        {
            // If KYC exists but isn't reachable from start, prefer making it the start step
            if (!string.Equals(wf.StartStep, "KYC", StringComparison.OrdinalIgnoreCase))
            {
                // Point KYC to current start to preserve flow
                if (string.IsNullOrWhiteSpace(existing.Next))
                {
                    existing.Next = wf.StartStep ?? wf.Steps.FirstOrDefault(s => !string.Equals(s.Name, "KYC", StringComparison.OrdinalIgnoreCase))?.Name;
                }
                wf.StartStep = "KYC";
            }
            return;
        }

        // Insert a new KYC step at the start of the workflow
        var next = wf.StartStep ?? wf.Steps.FirstOrDefault()?.Name ?? "CREDIT_CHECK";
        var kyc = new WorkflowStep { Name = "KYC", Next = next };
        wf.Steps.Add(kyc);
        wf.StartStep = "KYC";
    }

    private static string ExtractIdentifier(string tail)
    {
        // crude identifier extraction: take first token of letters/numbers/_
        var id = new string(tail.TakeWhile(ch => char.IsLetterOrDigit(ch) || ch == '_' || ch == '-').ToArray());
        return id;
    }
}

public class AIWorkflowRequest
{
    public string Message { get; set; } = string.Empty;
    public string? CurrentWorkflowJson { get; set; }
    public string? WorkflowType { get; set; }
}

public class WorkflowDefinition
{
    public string WorkflowType { get; set; } = string.Empty;
    public string? StartStep { get; set; }
    public List<WorkflowStep> Steps { get; set; } = new();
}

public class WorkflowStep
{
    public string Name { get; set; } = string.Empty;
    public string? ConditionExpressionId { get; set; }
    public string? Next { get; set; }
    public string? ElseNext { get; set; }
    public List<string>? RequiredActions { get; set; }
}

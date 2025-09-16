using LoanService.Data;
using LoanService.Models;
using LoanService.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace LoanService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public partial class LoanOriginationController : ControllerBase
    {
    private readonly LoanDbContext _db;
    private readonly IExpressionEvaluationService _expressions;
    private readonly IWorkflowClient _workflow;
    private readonly IDynamicFormsClient _forms;
    private readonly IConfiguration _config;
        private readonly IWorkflowOrchestrator _localWF;
        private readonly ILogger<LoanOriginationController> _logger;

        public LoanOriginationController(
            LoanDbContext db,
            IExpressionEvaluationService expressions,
            IWorkflowClient workflow,
            IDynamicFormsClient forms,
            ILogger<LoanOriginationController> logger,
            IConfiguration config,
            IWorkflowOrchestrator? localWF = null)
        {
            _db = db;
            _expressions = expressions;
            _workflow = workflow;
            _forms = forms;
            _logger = logger;
            _config = config;
            _localWF = localWF ?? new NullWorkflowOrchestrator();
        }

        /// <summary>
        /// Get dynamic form schema for a loan product
        /// </summary>
        [HttpGet("form-schema/{productType}")]
        public async Task<ActionResult<object>> GetFormSchema(string productType)
        {
            var enableDynamic = _config.GetValue<bool>("FeatureFlags:EnableDynamicForms");
            if (enableDynamic)
            {
                try
                {
                    var fields = await _forms.GetLoanFormSchemaAsync(productType);
                    return Ok(new { productType, fields });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Dynamic forms fetch failed for {ProductType}, falling back to static schema", productType);
                    // fall through to static fallback
                }
            }

            // Static fallback (Phase 1)
            var staticPath = Path.Combine(AppContext.BaseDirectory, "Static", $"loan_form_{productType.ToUpperInvariant()}.json");
            if (!System.IO.File.Exists(staticPath))
            {
                return NotFound(new { error = $"Static schema not found for {productType}" });
            }
            var json = await System.IO.File.ReadAllTextAsync(staticPath);
            return Content(json, "application/json");
        }

        /// <summary>
        /// Pre-validate a loan application using expression engine
        /// </summary>
    [HttpPost("pre-validate")]
    public async Task<ActionResult<PreValidateResponse>> PreValidate([FromBody] PreValidateRequest request)
        {
            // Optional schema validation (Phase 3): if dynamic enabled, validate against schema
            var enableDynamic = _config.GetValue<bool>("FeatureFlags:EnableDynamicForms");
            if (enableDynamic)
            {
                List<DynamicField>? schema = null;
                try
                {
                    schema = await _forms.GetLoanFormSchemaAsync(request.ProductType ?? "PERSONAL_LOAN");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Dynamic forms fetch failed during pre-validate. Attempting static fallback.");
                    schema = LoadStaticSchemaFields(request.ProductType ?? "PERSONAL_LOAN");
                }
                if (schema != null)
                {
                    var errors = ValidateAgainstSchema(schema, request);
                    if (errors.Count > 0)
                    {
                        return BadRequest(new { errors });
                    }
                }
            }

            var enableExpressions = _config.GetValue<bool>("FeatureFlags:EnableExpressions");

            if (enableExpressions)
            {
                var ctx = new Dictionary<string, object>
                {
                    ["customer.creditScore"] = request.CreditScore,
                    ["customer.monthlyIncome"] = request.MonthlyIncome,
                    ["customer.debtToIncomeRatio"] = request.DebtToIncomeRatio,
                    ["loan.amount"] = request.LoanAmount,
                    ["loan.tenure"] = request.TenureMonths,
                    ["product.type"] = request.ProductType ?? "PERSONAL_LOAN"
                };

                var eligibility = await _expressions.EvaluateLoanEligibilityAsync(request.CustomerId, request.LoanAmount, new Dictionary<string, object>
                {
                    ["creditScore"] = request.CreditScore,
                    ["monthlyIncome"] = request.MonthlyIncome,
                    ["debtToIncomeRatio"] = request.DebtToIncomeRatio
                });

                decimal? rate = null;
                if (eligibility == "APPROVED")
                {
                    rate = await _expressions.CalculateInterestRateAsync(request.ProductType ?? "PERSONAL_LOAN", new Dictionary<string, object>(ctx));
                }

                // Generate detailed message based on expression result and criteria
                var message = GetDetailedEligibilityMessage(eligibility, request);
                var failureReasons = eligibility == "REJECTED" ? GetFailureReasons(request) : null;

                return Ok(new PreValidateResponse 
                { 
                    Eligibility = eligibility, 
                    InterestRate = rate,
                    Message = message,
                    FailureReasons = failureReasons
                });
            }

            // Phase 1: hardcoded eligibility/rate with detailed failure reasons
            var hardcodedFailureReasons = new List<string>();
            var hardcodedMessage = "";
            
            // Check individual criteria
            if (request.CreditScore < 650)
            {
                hardcodedFailureReasons.Add($"Credit score {request.CreditScore} is below minimum requirement of 650");
            }
            if (request.DebtToIncomeRatio > 0.45m)
            {
                hardcodedFailureReasons.Add($"Debt-to-income ratio {request.DebtToIncomeRatio:P1} exceeds maximum allowed of 45%");
            }
            if (request.MonthlyIncome < 15000)
            {
                hardcodedFailureReasons.Add($"Monthly income ₹{request.MonthlyIncome:N0} is below minimum requirement of ₹15,000");
            }

            string eligibilityLocal;
            if (hardcodedFailureReasons.Any())
            {
                eligibilityLocal = "REJECTED";
                hardcodedMessage = $"Application rejected. Reasons: {string.Join("; ", hardcodedFailureReasons)}";
            }
            else if (request.CreditScore >= 700 && request.DebtToIncomeRatio <= 0.45m && request.MonthlyIncome >= 15000)
            {
                eligibilityLocal = "APPROVED";
                hardcodedMessage = "Application pre-approved! All criteria met.";
            }
            else
            {
                eligibilityLocal = "MANUAL_REVIEW";
                hardcodedMessage = "Application requires manual review. Credit score between 650-699 or other factors need assessment.";
            }

            decimal? rateLocal = eligibilityLocal == "APPROVED"
                ? Math.Round(10m + Math.Max(0, 750 - request.CreditScore) * 0.01m, 2)
                : null;

            return Ok(new PreValidateResponse 
            { 
                Eligibility = eligibilityLocal, 
                InterestRate = rateLocal,
                Message = hardcodedMessage,
                FailureReasons = hardcodedFailureReasons.Any() ? hardcodedFailureReasons : null
            });
        }

        /// <summary>
        /// Submit application: persists, starts workflow, returns status
        /// </summary>
        [HttpPost("submit")]
    public async Task<ActionResult<SubmitApplicationResponse>> Submit([FromBody] SubmitApplicationRequest request)
        {
            // Optional schema validation (Phase 3)
            var enableDynamic = _config.GetValue<bool>("FeatureFlags:EnableDynamicForms");
            if (enableDynamic)
            {
                List<DynamicField>? schema = null;
                try
                {
                    schema = await _forms.GetLoanFormSchemaAsync(request.ProductType ?? "PERSONAL_LOAN");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Dynamic forms fetch failed during submit. Attempting static fallback.");
                    schema = LoadStaticSchemaFields(request.ProductType ?? "PERSONAL_LOAN");
                }
                if (schema != null)
                {
                    var errors = ValidateAgainstSchema(schema, request);
                    if (errors.Count > 0)
                    {
                        return BadRequest(new { errors });
                    }
                }
            }

            var enableExpressions = _config.GetValue<bool>("FeatureFlags:EnableExpressions");
            var enableWorkflow = _config.GetValue<bool>("FeatureFlags:EnableWorkflow");
            var useLocalOrchestrator = _config.GetValue<bool>("FeatureFlags:UseLocalWorkflowOrchestrator");

            string eligibility;
            decimal rate;

            if (enableExpressions)
            {
                eligibility = await _expressions.EvaluateLoanEligibilityAsync(request.CustomerId, request.LoanAmount, new Dictionary<string, object>
                {
                    ["creditScore"] = request.CreditScore,
                    ["monthlyIncome"] = request.MonthlyIncome,
                    ["debtToIncomeRatio"] = request.DebtToIncomeRatio
                });
            }
            else
            {
                eligibility = (request.CreditScore >= 700 && request.DebtToIncomeRatio <= 0.45m && request.MonthlyIncome >= 15000)
                    ? "APPROVED"
                    : (request.CreditScore >= 650 ? "MANUAL_REVIEW" : "REJECTED");
            }

            if (eligibility == "REJECTED")
            {
                return Ok(new SubmitApplicationResponse
                {
                    Status = "REJECTED",
                    Message = "Application rejected by eligibility rules"
                });
            }

            // 2) Persist LoanApplication (Phase 1)
            var app = new LoanApplication
            {
                Id = Guid.NewGuid(),
                CustomerId = request.CustomerId,
                ProductType = request.ProductType ?? "PERSONAL_LOAN",
                Amount = request.LoanAmount,
                TenureMonths = request.TenureMonths,
                Status = "SUBMITTED",
                FormDataJson = null
            };
            _db.LoanApplications.Add(app);
            await _db.SaveChangesAsync();

            // 3) Calculate rate
            if (enableExpressions)
            {
                rate = await _expressions.CalculateInterestRateAsync(request.ProductType ?? "PERSONAL_LOAN", new Dictionary<string, object>
                {
                    ["loanAmount"] = request.LoanAmount,
                    ["loanTenure"] = request.TenureMonths,
                    ["productType"] = request.ProductType ?? "PERSONAL_LOAN",
                    ["creditScore"] = request.CreditScore,
                    ["monthlyIncome"] = request.MonthlyIncome
                });
            }
            else
            {
                rate = Math.Round(12m - Math.Min(3m, (request.CreditScore - 700) * 0.01m), 2);
            }
            app.InterestRate = rate;
            await _db.SaveChangesAsync();

            // 4) Workflow (Phase 1: hardcoded steps when disabled)
            Guid workflowId;
            string? currentStep = null;
            if (enableWorkflow)
            {
                try
                {
                    var wfCtx = new Dictionary<string, object>
                    {
                        ["loan.amount"] = request.LoanAmount,
                        ["loan.type"] = request.ProductType ?? "PERSONAL_LOAN",
                        ["customer.creditScore"] = request.CreditScore
                    };
                    if (useLocalOrchestrator)
                    {
                        var local = await _localWF.StartAsync(app.Id, wfCtx, "LOAN_ORIGINATION");
                        workflowId = local.Id;
                        app.WorkflowInstanceId = workflowId;
                        app.Status = local.Status;
                        currentStep = local.CurrentStep;
                    }
                    else
                    {
                        var wf = await _workflow.StartLoanOriginationAsync(app.Id, wfCtx);
                        workflowId = wf.Id;
                        app.WorkflowInstanceId = workflowId;
                        // Adopt engine-reported status when available
                        if (!string.IsNullOrWhiteSpace(wf.Status))
                        {
                            app.Status = wf.Status;
                        }
                        currentStep = wf.CurrentStep;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Workflow start failed for Application {ApplicationId}", app.Id);
                    app.Status = "ERROR";
                    await _db.SaveChangesAsync();
                    return StatusCode(503, new SubmitApplicationResponse
                    {
                        Status = app.Status,
                        ApplicationId = app.Id,
                        WorkflowInstanceId = app.WorkflowInstanceId ?? Guid.Empty,
                        InterestRate = rate,
                        Message = "Workflow service unavailable. Please retry later."
                    });
                }
            }
            else
            {
                // Emulate a simple linear flow
                workflowId = app.Id; // reuse app id as pseudo workflow id
                app.WorkflowInstanceId = workflowId;
                app.Status = eligibility == "APPROVED" ? "IN_REVIEW" : eligibility;
            }
            await _db.SaveChangesAsync();

            return Ok(new SubmitApplicationResponse
            {
                Status = app.Status,
                ApplicationId = app.Id,
                WorkflowInstanceId = app.WorkflowInstanceId ?? workflowId,
                CurrentStep = currentStep ?? string.Empty,
                InterestRate = rate,
                Message = enableWorkflow ? "Application submitted and workflow started" : "Application submitted (hardcoded workflow)"
            });
        }
        // Phase 3: simple server-side schema validation for known fields
    private static List<string> ValidateAgainstSchema(IEnumerable<DynamicField> fields, PreValidateRequest req)
        {
            var errors = new List<string>();
            foreach (var f in fields)
            {
                var name = f.Name?.Trim();
                if (string.IsNullOrEmpty(name)) continue;
                switch (name)
                {
                    case "fullName":
                        // Placeholder for future free-text validation
                        break;
                    case "email":
                        // Placeholder for email pattern
                        break;
                    case "loanAmount":
                        if (f.Required == true && req.LoanAmount == 0) errors.Add("loanAmount is required");
                        if (f.Min.HasValue && req.LoanAmount < f.Min.Value) errors.Add($"loanAmount must be >= {f.Min.Value}");
                        if (f.Max.HasValue && req.LoanAmount > f.Max.Value) errors.Add($"loanAmount must be <= {f.Max.Value}");
                        break;
                    case "tenureMonths":
                        if (f.Required == true && req.TenureMonths == 0) errors.Add("tenureMonths is required");
                        if (f.Min.HasValue && req.TenureMonths < f.Min.Value) errors.Add($"tenureMonths must be >= {f.Min.Value}");
                        if (f.Max.HasValue && req.TenureMonths > f.Max.Value) errors.Add($"tenureMonths must be <= {f.Max.Value}");
                        break;
                    case "monthlyIncome":
                        if (f.Required == true && req.MonthlyIncome == 0) errors.Add("monthlyIncome is required");
                        if (f.Min.HasValue && req.MonthlyIncome < f.Min.Value) errors.Add($"monthlyIncome must be >= {f.Min.Value}");
                        if (f.Max.HasValue && req.MonthlyIncome > f.Max.Value) errors.Add($"monthlyIncome must be <= {f.Max.Value}");
                        break;
                    case "creditScore":
                        if (f.Required == true && req.CreditScore == 0) errors.Add("creditScore is required");
                        if (f.Min.HasValue && req.CreditScore < f.Min.Value) errors.Add($"creditScore must be >= {f.Min.Value}");
                        if (f.Max.HasValue && req.CreditScore > f.Max.Value) errors.Add($"creditScore must be <= {f.Max.Value}");
                        break;
                }
            }
            return errors;
        }

        private static List<DynamicField>? LoadStaticSchemaFields(string productType)
        {
            try
            {
                var staticPath = Path.Combine(AppContext.BaseDirectory, "Static", $"loan_form_{productType.ToUpperInvariant()}.json");
                if (!System.IO.File.Exists(staticPath)) return null;
                using var stream = System.IO.File.OpenRead(staticPath);
                using var doc = JsonDocument.Parse(stream);
                if (!doc.RootElement.TryGetProperty("fields", out var fieldsEl) || fieldsEl.ValueKind != JsonValueKind.Array)
                    return null;
                var list = new List<DynamicField>();
                foreach (var f in fieldsEl.EnumerateArray())
                {
                    var df = new DynamicField
                    {
                        Name = f.TryGetProperty("name", out var n) ? n.GetString() ?? string.Empty : string.Empty,
                        Label = f.TryGetProperty("label", out var l) ? l.GetString() : null,
                        Type = f.TryGetProperty("type", out var t) ? t.GetString() : null,
                        Required = f.TryGetProperty("required", out var r) ? r.GetBoolean() : (bool?)null,
                        Min = f.TryGetProperty("min", out var min) && min.ValueKind != JsonValueKind.Null ? min.GetDecimal() : (decimal?)null,
                        Max = f.TryGetProperty("max", out var max) && max.ValueKind != JsonValueKind.Null ? max.GetDecimal() : (decimal?)null
                    };
                    list.Add(df);
                }
                return list;
            }
            catch
            {
                return null;
            }
        }

    }

    public class PreValidateRequest
    {
        public string CustomerId { get; set; } = string.Empty;
        public decimal LoanAmount { get; set; }
        public int TenureMonths { get; set; }
        public int CreditScore { get; set; }
        public decimal MonthlyIncome { get; set; }
        public decimal DebtToIncomeRatio { get; set; }
        public string? ProductType { get; set; }
    }

    public class SubmitApplicationRequest : PreValidateRequest { }
    public class PreValidateResponse
    {
        public string Eligibility { get; set; } = string.Empty;
        public decimal? InterestRate { get; set; }
        public string? Message { get; set; }
        public List<string>? FailureReasons { get; set; }
    }

    public class SubmitApplicationResponse
    {
        public string Status { get; set; } = string.Empty;
    public Guid ApplicationId { get; set; }
        public Guid WorkflowInstanceId { get; set; }
    public string CurrentStep { get; set; } = string.Empty;
        public decimal InterestRate { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class ProcessWorkflowRequest
    {
        public string Action { get; set; } = "NEXT";
        public Dictionary<string, object>? Context { get; set; }
    }

    public partial class LoanOriginationController
    {
        /// <summary>
        /// Process a workflow step for an existing workflow instance (proxy to orchestrator)
        /// </summary>
        [HttpPost("{workflowInstanceId:guid}/process")] 
        public async Task<ActionResult<WorkflowStepResult>> Process(Guid workflowInstanceId, [FromBody] ProcessWorkflowRequest req)
        {
            var enableWorkflow = _config.GetValue<bool>("FeatureFlags:EnableWorkflow");
            if (!enableWorkflow)
            {
                return BadRequest(new { error = "Workflow is disabled" });
            }

            var useLocal = _config.GetValue<bool>("FeatureFlags:UseLocalWorkflowOrchestrator");
            var ctx = req.Context ?? new Dictionary<string, object>();
            try
            {
                if (useLocal)
                {
                    var res = await _localWF.ProcessStepAsync(workflowInstanceId, req.Action, ctx, "LOAN_ORIGINATION");
                    return Ok(res);
                }
                else
                {
                    var res = await _workflow.ProcessStepAsync(workflowInstanceId, req.Action, ctx);
                    return Ok(res);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Workflow step processing failed for {WorkflowInstanceId}", workflowInstanceId);
                return StatusCode(503, new { error = "Workflow processing failed" });
            }
        }

        private string GetDetailedEligibilityMessage(string eligibility, PreValidateRequest request)
        {
            return eligibility switch
            {
                "APPROVED" => "Congratulations! Your application has been pre-approved. All eligibility criteria are met.",
                "MANUAL_REVIEW" => "Your application requires manual review. One or more criteria need further assessment by our team.",
                "REJECTED" => $"Unfortunately, your application doesn't meet our current eligibility criteria. Please see specific reasons below.",
                _ => "Unable to determine eligibility status at this time. Please contact support."
            };
        }

        private List<string> GetFailureReasons(PreValidateRequest request)
        {
            var reasons = new List<string>();
            
            if (request.CreditScore < 650)
            {
                reasons.Add($"Credit score {request.CreditScore} is below minimum requirement of 650");
            }
            if (request.DebtToIncomeRatio > 0.45m)
            {
                reasons.Add($"Debt-to-income ratio {request.DebtToIncomeRatio:P1} exceeds maximum allowed of 45%");
            }
            if (request.MonthlyIncome < 15000)
            {
                reasons.Add($"Monthly income ₹{request.MonthlyIncome:N0} is below minimum requirement of ₹15,000");
            }
            if (request.LoanAmount > request.MonthlyIncome * 60) // 5 years worth of income
            {
                reasons.Add($"Requested loan amount ₹{request.LoanAmount:N0} is too high relative to monthly income");
            }

            return reasons;
        }
    }
}

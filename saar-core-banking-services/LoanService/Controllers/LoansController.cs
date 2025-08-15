using Microsoft.AspNetCore.Mvc;
using LoanService.Services;

namespace LoanService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LoansController : ControllerBase
    {
        private readonly IExpressionEvaluationService _expressionService;
        private readonly ILogger<LoansController> _logger;

        public LoansController(IExpressionEvaluationService expressionService, ILogger<LoansController> logger)
        {
            _expressionService = expressionService;
            _logger = logger;
        }

        /// <summary>
        /// Check loan eligibility using dynamic business rules
        /// </summary>
        [HttpPost("eligibility")]
        public async Task<ActionResult<LoanEligibilityResponse>> CheckEligibility([FromBody] LoanEligibilityRequest request)
        {
            try
            {
                var customerData = new Dictionary<string, object>
                {
                    ["creditScore"] = request.CreditScore,
                    ["monthlyIncome"] = request.MonthlyIncome,
                    ["debtToIncomeRatio"] = request.DebtToIncomeRatio,
                    ["age"] = request.Age,
                    ["employmentType"] = request.EmploymentType ?? "SALARIED"
                };

                // Use expression rule for eligibility
                string eligibilityResult = await _expressionService.EvaluateLoanEligibilityAsync(
                    request.CustomerId, 
                    request.LoanAmount, 
                    customerData);

                // Calculate interest rate using expressions if approved
                decimal? interestRate = null;
                if (eligibilityResult == "APPROVED")
                {
                    var rateContext = new Dictionary<string, object>(customerData)
                    {
                        ["loanAmount"] = request.LoanAmount,
                        ["loanTenure"] = request.TenureMonths,
                        ["productType"] = request.ProductType ?? "PERSONAL_LOAN"
                    };
                    
                    try
                    {
                        interestRate = await _expressionService.CalculateInterestRateAsync(
                            request.ProductType ?? "PERSONAL_LOAN", 
                            rateContext);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to calculate interest rate, using default");
                        interestRate = 12.0m; // Default rate
                    }
                }

                return Ok(new LoanEligibilityResponse
                {
                    CustomerId = request.CustomerId,
                    LoanAmount = request.LoanAmount,
                    EligibilityStatus = eligibilityResult,
                    InterestRate = interestRate,
                    MaxLoanAmount = eligibilityResult == "APPROVED" ? request.LoanAmount * 1.2m : null,
                    Message = GetEligibilityMessage(eligibilityResult),
                    ProcessedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking loan eligibility for customer {CustomerId}", request.CustomerId);
                return StatusCode(500, new { error = "Failed to process eligibility check" });
            }
        }

        /// <summary>
        /// Apply business rules for loan approval workflow
        /// </summary>
        [HttpPost("{loanId}/approve")]
        public async Task<ActionResult<LoanApprovalResponse>> ApproveLoan(string loanId, [FromBody] LoanApprovalRequest request)
        {
            try
            {
                // Use expressions for approval workflow rules
                var approvalContext = new Dictionary<string, object>
                {
                    ["loan.amount"] = request.LoanAmount,
                    ["loan.type"] = request.LoanType,
                    ["approver.level"] = request.ApproverLevel,
                    ["customer.riskCategory"] = request.CustomerRiskCategory ?? "MEDIUM"
                };

                // Expression to determine if manual approval is needed
                const string APPROVAL_WORKFLOW_EXPRESSION = "EXPR_APPROVAL_WORKFLOW";
                string workflowDecision = await _expressionService.EvaluateExpressionAsync<string>(
                    APPROVAL_WORKFLOW_EXPRESSION, 
                    approvalContext);

                return Ok(new LoanApprovalResponse
                {
                    LoanId = loanId,
                    ApprovalStatus = workflowDecision,
                    RequiresManualReview = workflowDecision == "MANUAL_REVIEW",
                    NextApproverLevel = GetNextApproverLevel(workflowDecision),
                    ProcessedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing loan approval for {LoanId}", loanId);
                return StatusCode(500, new { error = "Failed to process loan approval" });
            }
        }

        private string GetEligibilityMessage(string status)
        {
            return status switch
            {
                "APPROVED" => "Congratulations! Your loan application is approved.",
                "MANUAL_REVIEW" => "Your application requires manual review. We'll contact you within 2 business days.",
                "REJECTED" => "Unfortunately, you don't meet the current eligibility criteria.",
                _ => "Unable to determine eligibility status."
            };
        }

        private string? GetNextApproverLevel(string workflowDecision)
        {
            return workflowDecision switch
            {
                "MANUAL_REVIEW" => "SENIOR_MANAGER",
                "ESCALATE" => "BRANCH_MANAGER",
                _ => null
            };
        }
    }

    public class LoanEligibilityRequest
    {
        public string CustomerId { get; set; } = string.Empty;
        public decimal LoanAmount { get; set; }
        public int CreditScore { get; set; }
        public decimal MonthlyIncome { get; set; }
        public decimal DebtToIncomeRatio { get; set; }
        public int Age { get; set; }
        public int TenureMonths { get; set; }
        public string? EmploymentType { get; set; }
        public string? ProductType { get; set; }
    }

    public class LoanEligibilityResponse
    {
        public string CustomerId { get; set; } = string.Empty;
        public decimal LoanAmount { get; set; }
        public string EligibilityStatus { get; set; } = string.Empty;
        public decimal? InterestRate { get; set; }
        public decimal? MaxLoanAmount { get; set; }
        public string Message { get; set; } = string.Empty;
        public DateTime ProcessedAt { get; set; }
    }

    public class LoanApprovalRequest
    {
        public decimal LoanAmount { get; set; }
        public string LoanType { get; set; } = string.Empty;
        public string ApproverLevel { get; set; } = string.Empty;
        public string? CustomerRiskCategory { get; set; }
    }

    public class LoanApprovalResponse
    {
        public string LoanId { get; set; } = string.Empty;
        public string ApprovalStatus { get; set; } = string.Empty;
        public bool RequiresManualReview { get; set; }
        public string? NextApproverLevel { get; set; }
        public DateTime ProcessedAt { get; set; }
    }
}

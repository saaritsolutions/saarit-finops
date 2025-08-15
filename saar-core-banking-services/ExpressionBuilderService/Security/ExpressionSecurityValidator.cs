using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace ExpressionBuilderService.Security;

/// <summary>
/// Security validation result
/// </summary>
public class SecurityValidationResult
{
    public bool IsSecure { get; set; }
    public List<string> SecurityViolations { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public string RiskLevel { get; set; } = "Low";
}

/// <summary>
/// Interface for security validation of expressions
/// </summary>
public interface ISecurityValidator
{
    Task<SecurityValidationResult> ValidateExpressionSecurityAsync(string expressionText);
    bool IsNamespaceAllowed(string namespaceName);
    bool IsTypeAllowed(string typeName);
    bool IsMethodCallSafe(string methodName, string typeName);
}

/// <summary>
/// Security validator for expressions
/// </summary>
public class ExpressionSecurityValidator : ISecurityValidator
{
    private readonly ILogger<ExpressionSecurityValidator> _logger;

    // Allowed namespaces
    private readonly HashSet<string> _allowedNamespaces = new()
    {
        "System",
        "System.Collections.Generic",
        "System.Linq",
        "System.Math",
        "System.DateTime",
        "System.TimeSpan",
        "System.Text",
        "System.Text.RegularExpressions",
        "ExpressionBuilderService.Models",
        "ExpressionBuilderService.Functions"
    };

    // Blocked namespaces and types
    private readonly HashSet<string> _blockedNamespaces = new()
    {
        "System.IO",
        "System.Net",
        "System.Reflection",
        "System.Threading",
        "System.Diagnostics",
        "System.Security",
        "System.Runtime",
        "System.Data",
        "System.Configuration",
        "System.Web",
        "Microsoft.Win32",
        "System.DirectoryServices",
        "System.Management",
        "System.ServiceProcess"
    };

    private readonly HashSet<string> _blockedTypes = new()
    {
        "File", "FileStream", "StreamReader", "StreamWriter", "DirectoryInfo", "FileInfo",
        "Process", "ProcessStartInfo", "Thread", "Task", "Timer",
        "HttpClient", "WebClient", "Socket", "TcpClient", "UdpClient",
        "Registry", "RegistryKey", "Environment", "AppDomain",
        "Assembly", "Type", "MethodInfo", "PropertyInfo", "FieldInfo"
    };

    // Blocked method patterns
    private readonly List<Regex> _blockedMethodPatterns = new()
    {
        new Regex(@".*\.Load.*", RegexOptions.IgnoreCase),
        new Regex(@".*\.Create.*Process.*", RegexOptions.IgnoreCase),
        new Regex(@".*\.Execute.*", RegexOptions.IgnoreCase),
        new Regex(@".*\.GetType.*", RegexOptions.IgnoreCase),
        new Regex(@".*\.Invoke.*", RegexOptions.IgnoreCase),
        new Regex(@".*\.GetMethod.*", RegexOptions.IgnoreCase),
        new Regex(@".*\.Delete.*File.*", RegexOptions.IgnoreCase),
        new Regex(@".*\.Write.*File.*", RegexOptions.IgnoreCase),
        new Regex(@".*\.Read.*File.*", RegexOptions.IgnoreCase),
    };

    // Dangerous keywords
    private readonly HashSet<string> _dangerousKeywords = new()
    {
        "unsafe", "fixed", "stackalloc", "goto", 
        "extern", "DllImport", "Marshal", "GCHandle",
        "Activator.CreateInstance", "Assembly.Load", "Type.GetType",
        "File.", "Directory.", "Path.", "Environment.",
        "Process.", "Thread.", "Task.Run", "Parallel.",
        "HttpClient", "WebClient", "Socket", "NetworkStream"
    };

    // Safe banking functions (whitelist)
    private readonly HashSet<string> _safeBankingFunctions = new()
    {
        "CalculateSimpleInterest", "CalculateCompoundInterest", "CalculateEMI",
        "CalculateNPV", "CalculateIRR", "IsAccountActive", "GetAccountBalance",
        "GetAccountType", "IsAccountBlocked", "GetLastTransactionDate",
        "IsCustomerValid", "GetCustomerAge", "GetCustomerRiskCategory",
        "GetCustomerCreditLimit", "HasActiveLoans", "IsTransactionLimitExceeded",
        "IsTransactionTimeValid", "IsTransactionTypeAllowed", "GetDailyTransactionSum",
        "GetTransactionCount", "CalculateRiskScore", "IsSuspiciousTransaction",
        "GetTransactionRiskLevel", "RequiresManualApproval", "IsEligibleForLoan",
        "CalculateLoanEligibility", "GetMaxLoanAmount", "IsLoanDefaulter",
        "CalculateLTV", "CalculateBusinessDays", "GetNextBusinessDay",
        "IsBusinessDay", "IsHoliday", "AddBusinessDays", "ConvertCurrency",
        "GetExchangeRate", "RoundToCurrency", "IsCTRRequired", "IsSARRequired",
        "IsKYCCompliant", "IsAMLCompliant", "GenerateReferenceNumber",
        "IsValidIBAN", "IsValidAccountNumber", "MaskAccountNumber", "MaskCardNumber",
        "Percentage", "Average", "Median", "StandardDeviation", "Min", "Max",
        // Logical operators for business rules
        "IF", "AND", "OR", "NOT"
    };

    public ExpressionSecurityValidator(ILogger<ExpressionSecurityValidator> logger)
    {
        _logger = logger;
    }

    public async Task<SecurityValidationResult> ValidateExpressionSecurityAsync(string expressionText)
    {
        var result = new SecurityValidationResult { IsSecure = true };

        try
        {
            _logger.LogInformation("Starting security validation for expression");

            // 1. Check for dangerous keywords
            ValidateDangerousKeywords(expressionText, result);

            // 2. Parse and analyze syntax tree
            await ValidateSyntaxTreeAsync(expressionText, result);

            // 3. Check expression complexity
            ValidateComplexity(expressionText, result);

            // 4. Validate against injection patterns
            ValidateInjectionPatterns(expressionText, result);

            // 5. Check for resource usage patterns
            ValidateResourceUsage(expressionText, result);

            // Determine overall risk level
            DetermineRiskLevel(result);

            _logger.LogInformation("Security validation completed. IsSecure: {IsSecure}, Violations: {ViolationCount}", 
                result.IsSecure, result.SecurityViolations.Count);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during security validation");
            result.IsSecure = false;
            result.SecurityViolations.Add($"Security validation failed: {ex.Message}");
            result.RiskLevel = "High";
            return result;
        }
    }

    public bool IsNamespaceAllowed(string namespaceName)
    {
        if (string.IsNullOrEmpty(namespaceName))
            return false;

        // Check if explicitly blocked
        if (_blockedNamespaces.Any(blocked => namespaceName.StartsWith(blocked, StringComparison.OrdinalIgnoreCase)))
            return false;

        // Check if explicitly allowed
        return _allowedNamespaces.Any(allowed => namespaceName.StartsWith(allowed, StringComparison.OrdinalIgnoreCase));
    }

    public bool IsTypeAllowed(string typeName)
    {
        if (string.IsNullOrEmpty(typeName))
            return false;

        return !_blockedTypes.Contains(typeName, StringComparer.OrdinalIgnoreCase);
    }

    public bool IsMethodCallSafe(string methodName, string typeName)
    {
        var fullMethodName = $"{typeName}.{methodName}";

        // Check against blocked method patterns
        if (_blockedMethodPatterns.Any(pattern => pattern.IsMatch(fullMethodName)))
            return false;

        // Check if it's a safe banking function
        if (_safeBankingFunctions.Contains(methodName))
            return true;

        // Allow logical and conditional operators/functions
        var safeLogicalFunctions = new[]
        {
            "IF", "AND", "OR", "NOT", "XOR", "NAND", "NOR",
            "IIF", "ISNULL", "ISBLANK", "ISNUMBER", "ISTEXT", "ISERROR",
            "TRUE", "FALSE", "NULL"
        };

        if (safeLogicalFunctions.Contains(methodName, StringComparer.OrdinalIgnoreCase))
            return true;

        // Allow basic System methods
        var safeSystemMethods = new[]
        {
            "ToString", "GetHashCode", "Equals", "CompareTo", "Contains", "StartsWith", "EndsWith",
            "Substring", "Replace", "Trim", "TrimStart", "TrimEnd", "ToLower", "ToUpper", "Split", "Join",
            "Add", "Remove", "Insert", "IndexOf", "LastIndexOf", "Count", "Length",
            "Min", "Max", "Abs", "Round", "Floor", "Ceiling", "Pow", "Sqrt",
            "AddDays", "AddMonths", "AddYears", "ToShortDateString", "ToLongDateString",
            "Parse", "TryParse", "Convert", "Cast"
        };

        return safeSystemMethods.Contains(methodName, StringComparer.OrdinalIgnoreCase);
    }

    private void ValidateDangerousKeywords(string expressionText, SecurityValidationResult result)
    {
        foreach (var keyword in _dangerousKeywords)
        {
            if (expressionText.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            {
                result.IsSecure = false;
                result.SecurityViolations.Add($"Dangerous keyword detected: {keyword}");
            }
        }
    }

    private async Task ValidateSyntaxTreeAsync(string expressionText, SecurityValidationResult result)
    {
        try
        {
            // Wrap expression in a method for parsing
            var wrappedExpression = $"public class TempClass {{ public object TempMethod() {{ return {expressionText}; }} }}";
            var syntaxTree = CSharpSyntaxTree.ParseText(wrappedExpression);
            var root = await syntaxTree.GetRootAsync();

            var walker = new SecuritySyntaxWalker(this, result);
            walker.Visit(root);
        }
        catch (Exception ex)
        {
            result.IsSecure = false;
            result.SecurityViolations.Add($"Syntax analysis failed: {ex.Message}");
        }
    }

    private void ValidateComplexity(string expressionText, SecurityValidationResult result)
    {
        // Check expression length
        if (expressionText.Length > 5000)
        {
            result.Warnings.Add("Expression is very long, which may impact performance");
        }

        // Check nesting depth
        var maxDepth = CalculateNestingDepth(expressionText);
        if (maxDepth > 10)
        {
            result.Warnings.Add($"Expression has high nesting depth: {maxDepth}");
        }

        // Check for potential infinite loops (simplified)
        if (Regex.IsMatch(expressionText, @"\bwhile\s*\(.*\)|for\s*\(.*\)", RegexOptions.IgnoreCase))
        {
            result.IsSecure = false;
            result.SecurityViolations.Add("Loop constructs are not allowed in expressions");
        }
    }

    private void ValidateInjectionPatterns(string expressionText, SecurityValidationResult result)
    {
        // SQL injection patterns
        var sqlPatterns = new[]
        {
            @"(?i)(union|select|insert|update|delete|drop|create|alter)\s+",
            @"(?i)(exec|execute)\s*\(",
            @"(?i)(sp_|xp_)\w+",
            @"--\s*",
            @"/\*.*\*/"
        };

        foreach (var pattern in sqlPatterns)
        {
            if (Regex.IsMatch(expressionText, pattern))
            {
                result.IsSecure = false;
                result.SecurityViolations.Add("Potential SQL injection pattern detected");
                break;
            }
        }

        // Script injection patterns - made more specific to avoid false positives
        var scriptPatterns = new[]
        {
            @"<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>",
            @"\bjavascript\s*:",
            @"\bvbscript\s*:",
            @"\bon(click|load|error|focus|blur|change|submit|keyup|keydown|mouseover|mouseout)\s*=", // Specific HTML event handlers
            @"\beval\s*\(",
            @"\bsetTimeout\s*\(",
            @"\bsetInterval\s*\("
        };

        foreach (var pattern in scriptPatterns)
        {
            if (Regex.IsMatch(expressionText, pattern, RegexOptions.IgnoreCase))
            {
                result.IsSecure = false;
                result.SecurityViolations.Add("Potential script injection pattern detected");
                break;
            }
        }
    }

    private void ValidateResourceUsage(string expressionText, SecurityValidationResult result)
    {
        // Check for potential memory-intensive operations
        var memoryIntensivePatterns = new[]
        {
            @"new\s+\w*\[\s*\d{6,}\s*\]", // Large array allocation
            @"\.Repeat\s*\(\s*\d{5,}", // Large repetitions
            @"\.Range\s*\(\s*\d+\s*,\s*\d{6,}", // Large ranges
        };

        foreach (var pattern in memoryIntensivePatterns)
        {
            if (Regex.IsMatch(expressionText, pattern))
            {
                result.Warnings.Add("Expression may consume excessive memory");
                break;
            }
        }

        // Check for potential CPU-intensive operations
        var cpuIntensivePatterns = new[]
        {
            @"\.Pow\s*\([^,]+,\s*\d{3,}", // Large power operations
            @"factorial|fibonacci", // Potentially expensive algorithms
            @"\.OrderBy.*\.OrderBy", // Multiple sorts
        };

        foreach (var pattern in cpuIntensivePatterns)
        {
            if (Regex.IsMatch(expressionText, pattern, RegexOptions.IgnoreCase))
            {
                result.Warnings.Add("Expression may be CPU intensive");
                break;
            }
        }
    }

    private void DetermineRiskLevel(SecurityValidationResult result)
    {
        if (!result.IsSecure)
        {
            result.RiskLevel = "High";
        }
        else if (result.Warnings.Count > 3)
        {
            result.RiskLevel = "Medium";
        }
        else if (result.Warnings.Count > 0)
        {
            result.RiskLevel = "Low";
        }
        else
        {
            result.RiskLevel = "Minimal";
        }
    }

    private int CalculateNestingDepth(string expressionText)
    {
        int maxDepth = 0;
        int currentDepth = 0;

        foreach (char c in expressionText)
        {
            if (c == '(' || c == '{' || c == '[')
            {
                currentDepth++;
                maxDepth = Math.Max(maxDepth, currentDepth);
            }
            else if (c == ')' || c == '}' || c == ']')
            {
                currentDepth--;
            }
        }

        return maxDepth;
    }
}

/// <summary>
/// Syntax walker for security analysis
/// </summary>
public class SecuritySyntaxWalker : CSharpSyntaxWalker
{
    private readonly ISecurityValidator _securityValidator;
    private readonly SecurityValidationResult _result;

    public SecuritySyntaxWalker(ISecurityValidator securityValidator, SecurityValidationResult result)
    {
        _securityValidator = securityValidator;
        _result = result;
    }

    public override void VisitUsingDirective(UsingDirectiveSyntax node)
    {
        var namespaceName = node.Name?.ToString();
        if (!string.IsNullOrEmpty(namespaceName) && !_securityValidator.IsNamespaceAllowed(namespaceName))
        {
            _result.IsSecure = false;
            _result.SecurityViolations.Add($"Blocked namespace: {namespaceName}");
        }

        base.VisitUsingDirective(node);
    }

    public override void VisitIdentifierName(IdentifierNameSyntax node)
    {
        var identifier = node.Identifier.Text;

        // Check for blocked type names
        if (!_securityValidator.IsTypeAllowed(identifier))
        {
            _result.IsSecure = false;
            _result.SecurityViolations.Add($"Blocked type: {identifier}");
        }

        base.VisitIdentifierName(node);
    }

    public override void VisitInvocationExpression(InvocationExpressionSyntax node)
    {
        // Analyze method calls
        if (node.Expression is MemberAccessExpressionSyntax memberAccess)
        {
            var typeName = memberAccess.Expression?.ToString() ?? "";
            var methodName = memberAccess.Name.Identifier.Text;

            if (!_securityValidator.IsMethodCallSafe(methodName, typeName))
            {
                _result.IsSecure = false;
                _result.SecurityViolations.Add($"Unsafe method call: {typeName}.{methodName}");
            }
        }
        else if (node.Expression is IdentifierNameSyntax identifier)
        {
            var methodName = identifier.Identifier.Text;
            if (!_securityValidator.IsMethodCallSafe(methodName, ""))
            {
                _result.IsSecure = false;
                _result.SecurityViolations.Add($"Unsafe method call: {methodName}");
            }
        }

        base.VisitInvocationExpression(node);
    }

    public override void VisitObjectCreationExpression(ObjectCreationExpressionSyntax node)
    {
        var typeName = node.Type.ToString();
        if (!_securityValidator.IsTypeAllowed(typeName))
        {
            _result.IsSecure = false;
            _result.SecurityViolations.Add($"Blocked object creation: {typeName}");
        }

        base.VisitObjectCreationExpression(node);
    }

    public override void VisitUnsafeStatement(UnsafeStatementSyntax node)
    {
        _result.IsSecure = false;
        _result.SecurityViolations.Add("Unsafe code blocks are not allowed");
        base.VisitUnsafeStatement(node);
    }

    public override void VisitGotoStatement(GotoStatementSyntax node)
    {
        _result.IsSecure = false;
        _result.SecurityViolations.Add("Goto statements are not allowed");
        base.VisitGotoStatement(node);
    }

    public override void VisitForStatement(ForStatementSyntax node)
    {
        _result.IsSecure = false;
        _result.SecurityViolations.Add("For loops are not allowed in expressions");
        base.VisitForStatement(node);
    }

    public override void VisitWhileStatement(WhileStatementSyntax node)
    {
        _result.IsSecure = false;
        _result.SecurityViolations.Add("While loops are not allowed in expressions");
        base.VisitWhileStatement(node);
    }

    public override void VisitDoStatement(DoStatementSyntax node)
    {
        _result.IsSecure = false;
        _result.SecurityViolations.Add("Do-while loops are not allowed in expressions");
        base.VisitDoStatement(node);
    }
}

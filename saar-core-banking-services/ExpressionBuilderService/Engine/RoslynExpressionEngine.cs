using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using ExpressionBuilderService.Models;
using ExpressionBuilderService.Functions;
using ExpressionBuilderService.Security;
using System.Reflection;
using System.Text;

namespace ExpressionBuilderService.Engine;

/// <summary>
/// Core interface for expression compilation and execution
/// </summary>
public interface IExpressionEngine
{
    Task<ExpressionValidationResponse> ValidateExpressionAsync(string expressionText, string contextType, string returnType, Dictionary<string, object> variables);
    Task<ExpressionExecutionResponse> ExecuteExpressionAsync(string expressionText, string contextType, Dictionary<string, object> variables);
    Task<CompilationResult> CompileExpressionAsync(string expressionText, string contextType, string returnType);
    Task<ExpressionMetadata> AnalyzeExpressionAsync(string expressionText, string contextType);
}

/// <summary>
/// Results from expression compilation
/// </summary>
public class CompilationResult
{
    public bool Success { get; set; }
    public Assembly? CompiledAssembly { get; set; }
    public Type? ExpressionType { get; set; }
    public MethodInfo? ExecuteMethod { get; set; }
    public List<string> Errors { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public string? GeneratedCode { get; set; }
    public TimeSpan CompilationTime { get; set; }
    public long MemoryUsed { get; set; }
}

/// <summary>
/// Core expression engine implementation using Roslyn
/// </summary>
public class RoslynExpressionEngine : IExpressionEngine
{
    private readonly IBankingFunctionLibrary _bankingFunctions;
    private readonly ISecurityValidator _securityValidator;
    private readonly ILogger<RoslynExpressionEngine> _logger;

    // Cache for compiled expressions
    private readonly Dictionary<string, CompilationResult> _compilationCache = new();
    private readonly ReaderWriterLockSlim _cacheLock = new();

    // Allowed namespaces and types for security
    private readonly HashSet<string> _allowedNamespaces = new()
    {
        "System",
        "System.Collections.Generic",
        "System.Linq",
        "System.Text",
        "System.Text.RegularExpressions",
        "ExpressionBuilderService.Models",
        "ExpressionBuilderService.Functions"
    };

    private readonly HashSet<string> _blockedTypes = new()
    {
        "System.IO",
        "System.Net",
        "System.Reflection",
        "System.Threading",
        "System.Diagnostics",
        "System.Security",
        "System.Runtime"
    };

    public RoslynExpressionEngine(
        IBankingFunctionLibrary bankingFunctions,
        ISecurityValidator securityValidator,
        ILogger<RoslynExpressionEngine> logger)
    {
        _bankingFunctions = bankingFunctions;
        _securityValidator = securityValidator;
        _logger = logger;
    }

    public async Task<ExpressionValidationResponse> ValidateExpressionAsync(
        string expressionText, 
        string contextType, 
        string returnType, 
        Dictionary<string, object> variables)
    {
        try
        {
            _logger.LogInformation("Validating expression for context type: {ContextType}", contextType);

            // Security validation first
            var securityResult = await _securityValidator.ValidateExpressionSecurityAsync(expressionText);
            if (!securityResult.IsSecure)
            {
                return new ExpressionValidationResponse
                {
                    IsValid = false,
                    Errors = securityResult.SecurityViolations.ToList()
                };
            }

            // Syntax and semantic validation
            var compilationResult = await CompileExpressionAsync(expressionText, contextType, returnType);
            
            var response = new ExpressionValidationResponse
            {
                IsValid = compilationResult.Success,
                Errors = compilationResult.Errors,
                Warnings = compilationResult.Warnings
            };

            if (compilationResult.Success)
            {
                response.Metadata = await AnalyzeExpressionAsync(expressionText, contextType);
            }

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating expression");
            return new ExpressionValidationResponse
            {
                IsValid = false,
                Errors = new List<string> { $"Validation error: {ex.Message}" }
            };
        }
    }

    public async Task<ExpressionExecutionResponse> ExecuteExpressionAsync(
        string expressionText, 
        string contextType, 
        Dictionary<string, object> variables)
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        var memoryBefore = GC.GetTotalMemory(false);

        try
        {
            _logger.LogInformation("Executing expression for context type: {ContextType}", contextType);

            // Get or compile the expression
            var cacheKey = GenerateCacheKey(expressionText, contextType);
            var compilationResult = await GetOrCompileExpression(cacheKey, expressionText, contextType, "object");

            if (!compilationResult.Success)
            {
                return new ExpressionExecutionResponse
                {
                    Success = false,
                    ErrorMessage = string.Join("; ", compilationResult.Errors),
                    ExecutedAt = DateTime.UtcNow
                };
            }

            // Execute the compiled expression
            var result = await ExecuteCompiledExpression(compilationResult, variables);
            
            stopwatch.Stop();
            var memoryAfter = GC.GetTotalMemory(false);

            return new ExpressionExecutionResponse
            {
                Success = true,
                Result = result,
                ResultType = result?.GetType().Name ?? "null",
                ExecutionTimeMs = (int)stopwatch.ElapsedMilliseconds,
                MemoryUsedKB = (memoryAfter - memoryBefore) / 1024,
                ExecutedAt = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing expression");
            stopwatch.Stop();
            
            return new ExpressionExecutionResponse
            {
                Success = false,
                ErrorMessage = ex.Message,
                ExecutionTimeMs = (int)stopwatch.ElapsedMilliseconds,
                ExecutedAt = DateTime.UtcNow
            };
        }
    }

    public async Task<CompilationResult> CompileExpressionAsync(string expressionText, string contextType, string returnType)
    {
        var startTime = DateTime.UtcNow;
        var memoryBefore = GC.GetTotalMemory(false);

        try
        {
            _logger.LogInformation("Compiling expression for context: {ContextType}, return: {ReturnType}", contextType, returnType);

            // Generate the wrapper class code (may analyze expression asynchronously)
            var generatedCode = await GenerateWrapperCodeAsync(expressionText, contextType, returnType);

            // Create syntax tree
            var syntaxTree = CSharpSyntaxTree.ParseText(generatedCode);

            // Get references
            var references = GetCompilationReferences();

            // Create compilation
            var compilation = CSharpCompilation.Create(
                assemblyName: $"DynamicExpression_{Guid.NewGuid():N}",
                syntaxTrees: new[] { syntaxTree },
                references: references,
                options: new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary)
                    .WithOptimizationLevel(OptimizationLevel.Release)
                    .WithPlatform(Platform.AnyCpu));

            // Compile to memory stream
            using var ms = new MemoryStream();
            var emitResult = compilation.Emit(ms);

            var compilationTime = DateTime.UtcNow - startTime;
            var memoryAfter = GC.GetTotalMemory(false);

            if (!emitResult.Success)
            {
                var errors = emitResult.Diagnostics
                    .Where(d => d.Severity == DiagnosticSeverity.Error)
                    .Select(d => d.ToString())
                    .ToList();

                var warnings = emitResult.Diagnostics
                    .Where(d => d.Severity == DiagnosticSeverity.Warning)
                    .Select(d => d.ToString())
                    .ToList();

                // Log the generated code to help debug Roslyn errors in Development
                try
                {
                    _logger.LogError("Expression compilation failed. Diagnostics: {Errors}", string.Join("; ", errors));
                    _logger.LogDebug("Generated expression wrapper code:\n{Code}", generatedCode);
                }
                catch { /* ignore logging errors */ }

                // Include generated code as an additional error entry for consumers in Development
                errors.Add("--- Generated code start ---");
                errors.Add(generatedCode);
                errors.Add("--- Generated code end ---");

                return new CompilationResult
                {
                    Success = false,
                    Errors = errors,
                    Warnings = warnings,
                    GeneratedCode = generatedCode,
                    CompilationTime = compilationTime,
                    MemoryUsed = memoryAfter - memoryBefore
                };
            }

            // Load the assembly
            ms.Seek(0, SeekOrigin.Begin);
            var assembly = Assembly.Load(ms.ToArray());
            var expressionType = assembly.GetType("DynamicExpression.ExpressionWrapper");
            var executeMethod = expressionType?.GetMethod("Execute");

            return new CompilationResult
            {
                Success = true,
                CompiledAssembly = assembly,
                ExpressionType = expressionType,
                ExecuteMethod = executeMethod,
                GeneratedCode = generatedCode,
                CompilationTime = compilationTime,
                MemoryUsed = memoryAfter - memoryBefore
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error compiling expression");
            return new CompilationResult
            {
                Success = false,
                Errors = new List<string> { $"Compilation error: {ex.Message}" },
                CompilationTime = DateTime.UtcNow - startTime,
                MemoryUsed = GC.GetTotalMemory(false) - memoryBefore
            };
        }
    }

    private string GenerateVariableDeclarations(IEnumerable<string> variableNames)
    {
        // Start with some common defaults
    var sb = new StringBuilder();
    sb.AppendLine("// Dynamic variables will be injected here");
    sb.AppendLine("var amount = variables.ContainsKey(\"amount\") ? SafeDecimal(variables[\"amount\"]) : 0m;");
    sb.AppendLine("var rate = variables.ContainsKey(\"rate\") ? SafeDecimal(variables[\"rate\"]) : 0m;");
    sb.AppendLine("var days = variables.ContainsKey(\"days\") ? SafeInt(variables[\"days\"]) : 0;");

        // Inject any discovered variables (avoid duplicates and known defaults)
        // don't emit declarations that will collide with context variables
        var defaults = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "amount", "rate", "days" };
        var reservedContextNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "customer", "account", "transaction", "loan", "contextobj", "context" };
        // Avoid creating locals that match available function names or logical operator helpers
        var functionNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            foreach (var fn in _bankingFunctions.GetAvailableFunctions()) functionNames.Add(fn);
        }
        catch { }
        // Add the built-in logical operator names
        functionNames.Add("IF");
        functionNames.Add("AND");
        functionNames.Add("OR");
        functionNames.Add("NOT");
        foreach (var name in variableNames.Where(n => !string.IsNullOrWhiteSpace(n)))
        {
            if (defaults.Contains(name)) continue;
            if (reservedContextNames.Contains(name))
            {
                // skip generating a local for a name that's already provided by the context
                continue;
            }
            if (functionNames.Contains(name))
            {
                // skip generating a local for names that correspond to functions/operators
                continue;
            }
            // Simple heuristics: integer-like names -> int, ratio/percent/income/balance -> decimal, otherwise object
            var lower = name.ToLowerInvariant();
            if (lower.Contains("count") || lower.Contains("age") || lower.Contains("score") || lower.EndsWith("id"))
            {
                sb.AppendLine($"var {name} = variables.ContainsKey(\"{name}\") ? SafeInt(variables[\"{name}\"]) : 0;");
            }
            else if (lower.Contains("ratio") || lower.Contains("income") || lower.Contains("amount") || lower.Contains("balance") || lower.Contains("rate") || lower.Contains("percent") || lower.Contains("decimal"))
            {
                sb.AppendLine($"var {name} = variables.ContainsKey(\"{name}\") ? SafeDecimal(variables[\"{name}\"]) : 0m;");
            }
            else
            {
                // fallback to object/string
                sb.AppendLine($"var {name} = variables.ContainsKey(\"{name}\") ? SafeObject(variables[\"{name}\"]) : null;");
            }
        }

        return sb.ToString();
    }

    public async Task<ExpressionMetadata> AnalyzeExpressionAsync(string expressionText, string contextType)
    {
        try
        {
            var syntaxTree = CSharpSyntaxTree.ParseText($"public class Temp {{ public object Execute() => {expressionText}; }}");
            var root = await syntaxTree.GetRootAsync();

            var metadata = new ExpressionMetadata();

            // Analyze syntax nodes
            var walker = new ExpressionAnalysisWalker(metadata, _bankingFunctions);
            walker.Visit(root);

            // Determine complexity
            metadata.ComplexityScore = CalculateComplexity(metadata);

            return metadata;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error analyzing expression");
            return new ExpressionMetadata();
        }
    }

    private async Task<string> GenerateWrapperCodeAsync(string expressionText, string contextType, string returnType)
    {
        var contextTypeName = GetContextTypeName(contextType);
        var returnTypeName = GetReturnTypeName(returnType);

        // Preprocess the expression text to handle string literals
        var processedExpression = PreprocessExpression(expressionText);

        // Analyze expression to discover used variables so we can declare locals
        var metadata = await AnalyzeExpressionAsync(expressionText, contextType);
        var variableDecls = GenerateVariableDeclarations(metadata?.Variables?.Keys ?? Enumerable.Empty<string>());

        // Helper methods injected into the generated wrapper to safely convert boxed values and JsonElement
        var helperMethods = @"
        private static int SafeInt(object? val, int defaultVal = 0)
        {
            if (val == null) return defaultVal;
            if (val is System.Text.Json.JsonElement je)
            {
                if (je.ValueKind == System.Text.Json.JsonValueKind.Number)
                {
                    if (je.TryGetInt32(out var i)) return i;
                    if (je.TryGetInt64(out var l)) return Convert.ToInt32(l);
                    if (je.TryGetDouble(out var d)) return Convert.ToInt32(d);
                }
                if (je.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    if (int.TryParse(je.GetString(), out var s)) return s;
                }
                return defaultVal;
            }
            try { return Convert.ToInt32(val); } catch { return defaultVal; }
        }

        private static decimal SafeDecimal(object? val, decimal defaultVal = 0m)
        {
            if (val == null) return defaultVal;
            if (val is System.Text.Json.JsonElement je)
            {
                if (je.ValueKind == System.Text.Json.JsonValueKind.Number)
                {
                    if (je.TryGetDecimal(out var d)) return d;
                    if (je.TryGetDouble(out var dd)) return Convert.ToDecimal(dd);
                    if (je.TryGetInt64(out var l)) return Convert.ToDecimal(l);
                }
                if (je.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    if (decimal.TryParse(je.GetString(), out var s)) return s;
                }
                return defaultVal;
            }
            try { return Convert.ToDecimal(val); } catch { return defaultVal; }
        }

        private static object? SafeObject(object? val)
        {
            if (val == null) return null;
            if (val is System.Text.Json.JsonElement je)
            {
                switch (je.ValueKind)
                {
                    case System.Text.Json.JsonValueKind.Number:
                        if (je.TryGetInt64(out var l)) return l;
                        if (je.TryGetDecimal(out var d)) return d;
                        if (je.TryGetDouble(out var dd)) return dd;
                        return je.GetRawText();
                    case System.Text.Json.JsonValueKind.String:
                        return je.GetString();
                    case System.Text.Json.JsonValueKind.True:
                        return true;
                    case System.Text.Json.JsonValueKind.False:
                        return false;
                    case System.Text.Json.JsonValueKind.Object:
                    case System.Text.Json.JsonValueKind.Array:
                        return val; // leave complex types to engine normalization path
                    default:
                        return null;
                }
            }
            return val;
        }
";

        return $@"
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using static System.Math;
using ExpressionBuilderService.Models;
using ExpressionBuilderService.Functions;
using static DynamicExpression.LogicalOperators;

namespace DynamicExpression
{{
    public static class LogicalOperators
    {{
        public static T IF<T>(bool condition, T trueValue, T falseValue) => condition ? trueValue : falseValue;
        public static bool AND(bool a, bool b) => a && b;
        public static bool AND(bool a, bool b, bool c) => a && b && c;
        public static bool AND(bool a, bool b, bool c, bool d) => a && b && c && d;
        public static bool OR(bool a, bool b) => a || b;
        public static bool OR(bool a, bool b, bool c) => a || b || c;
        public static bool NOT(bool a) => !a;
    }}
    
    public class ExpressionWrapper
    {{
        private readonly IBankingFunctionLibrary _banking;

        public ExpressionWrapper()
        {{
            _banking = new BankingFunctionLibrary();
        }}

    {helperMethods}

        public {returnTypeName} Execute({contextTypeName} context, Dictionary<string, object> variables)
        {{
            // Make context properties available as variables
            {GenerateContextVariables(contextType)}

            // Banking functions available
            var banking = _banking;

            // Expression variables
            {variableDecls}

            // The actual expression
            return ({returnTypeName})({processedExpression});
        }}
    }}
}}";
    }

    private string PreprocessExpression(string expressionText)
    {
        // Convert single-quoted strings to double-quoted strings for C#
        var pattern = @"'([^']*)'";
        var processed = System.Text.RegularExpressions.Regex.Replace(
            expressionText, 
            pattern, 
            match => $"\"{match.Groups[1].Value}\""
        );

        // Convert decimal literals to have 'm' suffix for decimal type compatibility
        // This handles comparisons like "< 0.4" to become "< 0.4m"
        var decimalPattern = @"\b(\d+\.\d+)\b";
        processed = System.Text.RegularExpressions.Regex.Replace(
            processed,
            decimalPattern,
            match => $"{match.Groups[1].Value}m"
        );

        return processed;
    }

    private string GenerateVariableDeclarations()
    {
        // This will be enhanced to generate variable declarations based on the context
        return @"
            // Dynamic variables will be injected here
            var amount = variables.ContainsKey(""amount"") ? SafeDecimal(variables[""amount""]) : 0m;
            var rate = variables.ContainsKey(""rate"") ? SafeDecimal(variables[""rate""]) : 0m;
            var days = variables.ContainsKey(""days"") ? SafeInt(variables[""days""]) : 0;
                // Common loan/customer aliases injected from flat variables
                var creditScore = variables.ContainsKey(""creditScore"") ? SafeInt(variables[""creditScore""]) : 0;
                var monthlyIncome = variables.ContainsKey(""monthlyIncome"") ? SafeDecimal(variables[""monthlyIncome""]) : 0m;
                var debtToIncomeRatio = variables.ContainsKey(""debtToIncomeRatio"") ? SafeDecimal(variables[""debtToIncomeRatio""]) : 0m;
        ";
    }

    private string GetContextTypeName(string contextType)
    {
        return contextType switch
        {
            "Customer" => "CustomerData",
            "Account" => "AccountData",
            "Transaction" => "TransactionData",
            "Loan" => "LoanData",
            _ => "object"
        };
    }

    private string GetReturnTypeName(string returnType)
    {
        return returnType switch
        {
            "boolean" => "bool",
            "decimal" => "decimal",
            "integer" => "int",
            "string" => "string",
            "datetime" => "DateTime",
            _ => "object"
        };
    }

    private string GenerateContextVariables(string contextType)
    {
        return contextType switch
        {
            "Customer" => "var customer = context;",
            "Account" => "var account = context;",
            "Transaction" => "var transaction = context;",
            "Loan" => "var loan = context;",
            _ => "var contextObj = context;" // fallback
        };
    }

    private List<MetadataReference> GetCompilationReferences()
    {
        var references = new List<MetadataReference>
        {
            MetadataReference.CreateFromFile(typeof(object).Assembly.Location),
            MetadataReference.CreateFromFile(typeof(Console).Assembly.Location),
            MetadataReference.CreateFromFile(typeof(IEnumerable<>).Assembly.Location),
            MetadataReference.CreateFromFile(typeof(Enumerable).Assembly.Location),
            MetadataReference.CreateFromFile(Assembly.GetExecutingAssembly().Location)
        };

        // Add additional references for .NET runtime
        var runtimePath = Path.GetDirectoryName(typeof(object).Assembly.Location)!;
        references.AddRange(new[]
        {
            MetadataReference.CreateFromFile(Path.Combine(runtimePath, "System.Runtime.dll")),
            MetadataReference.CreateFromFile(Path.Combine(runtimePath, "System.Collections.dll")),
            MetadataReference.CreateFromFile(Path.Combine(runtimePath, "System.Linq.dll")),
            MetadataReference.CreateFromFile(Path.Combine(runtimePath, "System.Text.RegularExpressions.dll"))
            // Ensure System.Text.Json types (JsonElement) are available for generated wrappers
            ,MetadataReference.CreateFromFile(Path.Combine(runtimePath, "System.Text.Json.dll"))
        });

        return references;
    }

    private async Task<CompilationResult> GetOrCompileExpression(string cacheKey, string expressionText, string contextType, string returnType)
    {
        _cacheLock.EnterReadLock();
        try
        {
            if (_compilationCache.TryGetValue(cacheKey, out var cached))
            {
                return cached;
            }
        }
        finally
        {
            _cacheLock.ExitReadLock();
        }

        var result = await CompileExpressionAsync(expressionText, contextType, returnType);

        if (result.Success)
        {
            _cacheLock.EnterWriteLock();
            try
            {
                _compilationCache[cacheKey] = result;
            }
            finally
            {
                _cacheLock.ExitWriteLock();
            }
        }

        return result;
    }

    private async Task<object?> ExecuteCompiledExpression(CompilationResult compilationResult, Dictionary<string, object> variables)
    {
        if (compilationResult.ExecuteMethod == null)
            throw new InvalidOperationException("Execute method not found in compiled expression");

        var instance = Activator.CreateInstance(compilationResult.ExpressionType!);
    // Normalize incoming variables (convert JsonElement -> CLR primitives/objects)
    var normalizedVariables = NormalizeVariables(variables);

    // Create context object based on normalized variables
    var context = CreateContextFromVariables(normalizedVariables);

    return await Task.FromResult(compilationResult.ExecuteMethod.Invoke(instance, new object[] { context, normalizedVariables }));
    }

    private object CreateContextFromVariables(Dictionary<string, object> variables)
    {
        // Try to construct a domain context object from provided variables
        try
        {
            if (variables.TryGetValue("customer", out var cust))
            {
                return BuildCustomerContext(cust, variables);
            }

            if (variables.TryGetValue("account", out var acc))
            {
                return BuildAccountContext(acc, variables);
            }

            // Fallback: infer from flat variables
            if (variables.ContainsKey("age") || variables.ContainsKey("creditScore") || variables.ContainsKey("monthlyIncome"))
            {
                return BuildCustomerContext(null, variables);
            }

            if (variables.ContainsKey("balance") || variables.ContainsKey("accountBalance"))
            {
                return BuildAccountContext(null, variables);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to build strong context from variables; falling back to object context");
        }

        // Last resort
        return new object();
    }

    private CustomerData BuildCustomerContext(object? customerSource, Dictionary<string, object> flat)
    {
        var cd = new CustomerData();

        // Helper to read from nested source first, then flat vars
        int? age = TryGetInt(customerSource, "age") ?? TryGetInt(flat, "age");
        if (age.HasValue && age.Value > 0)
        {
            // Set DateOfBirth so that alias property 'age' computes correctly
            cd.DateOfBirth = DateTime.UtcNow.AddYears(-age.Value);
        }

        var creditScore = TryGetInt(customerSource, "creditScore") ?? TryGetInt(flat, "creditScore");
        if (creditScore.HasValue) cd.CreditScore = creditScore.Value;

        var monthlyIncome = TryGetDecimal(customerSource, "monthlyIncome") ?? TryGetDecimal(flat, "monthlyIncome");
        if (monthlyIncome.HasValue) cd.MonthlyIncome = monthlyIncome.Value;

        var hasDefaultHistory = TryGetBool(customerSource, "hasDefaultHistory") ?? TryGetBool(flat, "hasDefaultHistory");
        if (hasDefaultHistory.HasValue) cd.HasDefaultHistory = hasDefaultHistory.Value;

        return cd;
    }

    private AccountData BuildAccountContext(object? accountSource, Dictionary<string, object> flat)
    {
        var ad = new AccountData();

        var balance = TryGetDecimal(accountSource, "balance") ?? TryGetDecimal(flat, "balance") ?? TryGetDecimal(flat, "accountBalance");
        if (balance.HasValue) ad.Balance = balance.Value;

        var type = TryGetString(accountSource, "type") ?? TryGetString(flat, "accountType");
        if (!string.IsNullOrWhiteSpace(type)) ad.AccountType = type!;

        return ad;
    }

    private int? TryGetInt(object? container, string key)
    {
        if (container == null) return null;
        try
        {
            if (container is Dictionary<string, object> dict && dict.TryGetValue(key, out var val))
                return Convert.ToInt32(Unwrap(val));
            if (container is System.Text.Json.JsonElement el && el.ValueKind == System.Text.Json.JsonValueKind.Object && el.TryGetProperty(key, out var prop))
                return prop.TryGetInt32(out var i) ? i : (int?)Convert.ToInt32(Unwrap(prop));
        }
        catch { }
        return null;
    }

    private decimal? TryGetDecimal(object? container, string key)
    {
        if (container == null) return null;
        try
        {
            if (container is Dictionary<string, object> dict && dict.TryGetValue(key, out var val))
                return Convert.ToDecimal(Unwrap(val));
            if (container is System.Text.Json.JsonElement el && el.ValueKind == System.Text.Json.JsonValueKind.Object && el.TryGetProperty(key, out var prop))
                return prop.TryGetDecimal(out var d) ? d : (decimal?)Convert.ToDecimal(Unwrap(prop));
        }
        catch { }
        return null;
    }

    private bool? TryGetBool(object? container, string key)
    {
        if (container == null) return null;
        try
        {
            if (container is Dictionary<string, object> dict && dict.TryGetValue(key, out var val))
                return Convert.ToBoolean(Unwrap(val));
            if (container is System.Text.Json.JsonElement el && el.ValueKind == System.Text.Json.JsonValueKind.Object && el.TryGetProperty(key, out var prop))
                return prop.ValueKind == System.Text.Json.JsonValueKind.True || (prop.ValueKind == System.Text.Json.JsonValueKind.String && bool.TryParse(prop.GetString(), out var b) && b);
        }
        catch { }
        return null;
    }

    private string? TryGetString(object? container, string key)
    {
        if (container == null) return null;
        try
        {
            if (container is Dictionary<string, object> dict && dict.TryGetValue(key, out var val))
                return Convert.ToString(Unwrap(val));
            if (container is System.Text.Json.JsonElement el && el.ValueKind == System.Text.Json.JsonValueKind.Object && el.TryGetProperty(key, out var prop))
                return prop.GetString();
        }
        catch { }
        return null;
    }

    private object? Unwrap(object? value)
    {
        if (value is System.Text.Json.JsonElement je)
        {
            try
            {
                switch (je.ValueKind)
                {
                    case System.Text.Json.JsonValueKind.Number:
                        if (je.TryGetInt32(out var i32)) return i32;
                        if (je.TryGetInt64(out var l)) return l;
                        if (je.TryGetDecimal(out var dec)) return dec;
                        if (je.TryGetDouble(out var d)) return d;
                        break;
                    case System.Text.Json.JsonValueKind.String:
                        return je.GetString();
                    case System.Text.Json.JsonValueKind.True:
                        return true;
                    case System.Text.Json.JsonValueKind.False:
                        return false;
                    case System.Text.Json.JsonValueKind.Object:
                    case System.Text.Json.JsonValueKind.Array:
                        // leave complex types as-is
                        return je;
                }
            }
            catch { /* fallthrough to return raw value if parsing fails */ }
        }
        return value;
    }

    private Dictionary<string, object> NormalizeVariables(Dictionary<string, object> variables)
    {
        var result = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in variables)
        {
            result[kv.Key] = NormalizeValue(kv.Value);
        }
        return result;
    }

    private object? NormalizeValue(object? value)
    {
        if (value == null) return null;

        // If it's a JsonElement, convert to CLR primitive, dictionary or list
        if (value is System.Text.Json.JsonElement je)
        {
            switch (je.ValueKind)
            {
                case System.Text.Json.JsonValueKind.Object:
                    var dict = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                    foreach (var prop in je.EnumerateObject())
                    {
                        dict[prop.Name] = NormalizeValue(prop.Value);
                    }
                    return dict;
                case System.Text.Json.JsonValueKind.Array:
                    var list = new List<object?>();
                    foreach (var item in je.EnumerateArray()) list.Add(NormalizeValue(item));
                    return list;
                case System.Text.Json.JsonValueKind.Number:
                    if (je.TryGetInt64(out var l)) return l;
                    if (je.TryGetDecimal(out var dec)) return dec;
                    if (je.TryGetDouble(out var d)) return d;
                    return je.GetRawText();
                case System.Text.Json.JsonValueKind.String:
                    return je.GetString();
                case System.Text.Json.JsonValueKind.True:
                    return true;
                case System.Text.Json.JsonValueKind.False:
                    return false;
                case System.Text.Json.JsonValueKind.Null:
                default:
                    return null;
            }
        }

        // If it's a dictionary with JsonElement values, normalize recursively
        if (value is Dictionary<string, object> dictVal)
        {
            var normalized = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in dictVal)
            {
                normalized[kv.Key] = NormalizeValue(kv.Value);
            }
            return normalized;
        }

        // If it's a JsonElement boxed as object via System.Text.Json.JsonElement (handled above)
        // If it's an enumerable, normalize items
        if (value is IEnumerable<object> enumObj)
        {
            return enumObj.Select(NormalizeValue).ToList();
        }

        // Primitive or already CLR-friendly
        return value;
    }

    private string GenerateCacheKey(string expressionText, string contextType)
    {
        return $"{contextType}:{expressionText.GetHashCode():X}";
    }

    private int CalculateComplexity(ExpressionMetadata metadata)
    {
        var score = metadata.MethodCallCount * 2 + metadata.VariableCount + metadata.ConditionalCount * 3;
        return score;
    }
}

/// <summary>
/// Syntax walker for analyzing expression components
/// </summary>
public class ExpressionAnalysisWalker : CSharpSyntaxWalker
{
    private readonly ExpressionMetadata _metadata;
    private readonly IBankingFunctionLibrary _bankingFunctions;

    public ExpressionAnalysisWalker(ExpressionMetadata metadata, IBankingFunctionLibrary bankingFunctions)
    {
        _metadata = metadata;
        _bankingFunctions = bankingFunctions;
    }

    public override void VisitIdentifierName(IdentifierNameSyntax node)
    {
        var variableName = node.Identifier.Text;
        if (!_metadata.UsedVariables.Contains(variableName))
        {
            _metadata.UsedVariables.Add(variableName);
        }
        if (!_metadata.Variables.ContainsKey(variableName))
        {
            _metadata.Variables.Add(variableName, node.Identifier.Text);
        }
        base.VisitIdentifierName(node);
    }

    public override void VisitInvocationExpression(InvocationExpressionSyntax node)
    {
        if (node.Expression is MemberAccessExpressionSyntax memberAccess)
        {
            var methodName = memberAccess.Name.Identifier.Text;
            if (!_metadata.UsedFunctions.Contains(methodName))
            {
                _metadata.UsedFunctions.Add(methodName);
            }
            if (!_metadata.Functions.Contains(methodName))
            {
                _metadata.Functions.Add(methodName);
            }

            // Check if it's a banking function
            if (_bankingFunctions.GetAvailableFunctions().Contains(methodName))
            {
                if (!_metadata.BankingFunctions.Contains(methodName))
                {
                    _metadata.BankingFunctions.Add(methodName);
                }
            }
        }

        base.VisitInvocationExpression(node);
    }

    public override void VisitConditionalExpression(ConditionalExpressionSyntax node)
    {
        _metadata.HasConditions = true;
        base.VisitConditionalExpression(node);
    }

    public override void VisitIfStatement(IfStatementSyntax node)
    {
        _metadata.HasConditions = true;
        base.VisitIfStatement(node);
    }
}

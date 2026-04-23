using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using UserAccessManagementService.Controllers;
using UserAccessManagementService.Models;

namespace UserAccessManagementService.Tests;

/// <summary>
/// SAAR-CFG-001: Tests for feature-flag JWT claims + TenantConfigController.
/// </summary>
[TestFixture]
public class TenantConfigTests
{
    // ── Shared helpers ────────────────────────────────────────────────────────

    private static UserAccessDbContext CreateDb(string name)
    {
        var opts = new DbContextOptionsBuilder<UserAccessDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new UserAccessDbContext(opts);
    }

    private static IConfiguration BuildConfig() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"]   = "SaarCoreBankingJwtSecret2026DemoKeyLongEnoughForHS256",
                ["Jwt:Issuer"]   = "saar-banking",
                ["Jwt:Audience"] = "saar-banking-clients",
            })
            .Build();

    private static void SeedTenantAndUser(
        UserAccessDbContext db,
        string tenantId   = "ucb_demo",
        bool goldLoan     = true,
        bool dynamicForms = true)
    {
        db.Tenants.Add(new Tenant
        {
            Id                     = tenantId,
            Name                   = "UCB Test Bank",
            FeatureGoldLoan        = goldLoan,
            FeatureDynamicForms    = dynamicForms,
            FeatureExpressions     = true,
            FeatureApprovalChain   = true,
            FeatureComplianceAlerts = false,
            FeatureFdRd            = true,
        });

        var role = new Role { Id = 1, Name = "Admin" };
        db.Roles.Add(role);

        var user = new User
        {
            Id           = 1,
            Username     = "admin",
            Email        = "admin@ucb-demo.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
            TenantId     = tenantId,
            IsActive     = true,
        };
        db.Users.Add(user);
        db.UserRoles.Add(new UserRole { UserId = 1, RoleId = 1, User = user, Role = role });

        db.SaveChanges();
    }

    private static TenantConfigController BuildController(
        UserAccessDbContext db,
        string tenantId,
        string role = "Admin")
    {
        var claims = new List<Claim>
        {
            new("tenant_id", tenantId),
            new(ClaimTypes.Role, role),
            new(ClaimTypes.Email, $"{role.ToLower()}@{tenantId}.com"),
        };
        var identity  = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);

        var controller = new TenantConfigController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal },
        };
        return controller;
    }

    // ── T-01: JWT contains feature-flag claims ────────────────────────────────

    [Test]
    public async Task Login_JWT_IncludesFeatureFlagClaims()
    {
        using var db     = CreateDb("jwt_flags_test");
        var       config = BuildConfig();

        // Seed tenant with gold loan DISABLED
        SeedTenantAndUser(db, goldLoan: false);

        var controller = new AuthController(db, config);
        var result     = await controller.Login(new LoginRequest("admin@ucb-demo.com", "admin123"));

        Assert.That(result, Is.InstanceOf<OkObjectResult>(), "Login should return 200 OK");
        var ok = (OkObjectResult)result;

        // Extract token via reflection (anonymous type)
        var tokenProp = ok.Value!.GetType().GetProperty("token")!;
        var token     = (string)tokenProp.GetValue(ok.Value)!;

        var handler = new JwtSecurityTokenHandler();
        var jwt     = handler.ReadJwtToken(token);

        var goldClaim = jwt.Claims.FirstOrDefault(c => c.Type == "feature_gold_loan");
        Assert.That(goldClaim,        Is.Not.Null,        "feature_gold_loan claim must be present");
        Assert.That(goldClaim!.Value, Is.EqualTo("false"), "feature_gold_loan should be 'false'");

        var dfClaim = jwt.Claims.FirstOrDefault(c => c.Type == "feature_dynamic_forms");
        Assert.That(dfClaim,         Is.Not.Null,        "feature_dynamic_forms claim must be present");
        Assert.That(dfClaim!.Value,  Is.EqualTo("true"), "feature_dynamic_forms should default to 'true'");
    }

    // ── T-02: GET /api/tenant-config returns correct config ──────────────────

    [Test]
    public async Task GetTenantConfig_Returns_CorrectFields()
    {
        using var db = CreateDb("get_config_test");
        db.Tenants.Add(new Tenant
        {
            Id                     = "ucb_demo",
            Name                   = "UCB Demo Bank",
            BankPhone              = "+91-9876543210",
            FeatureGoldLoan        = false,
            FeatureDynamicForms    = true,
            FeatureExpressions     = true,
            FeatureApprovalChain   = true,
            FeatureComplianceAlerts = false,
            FeatureFdRd            = true,
        });
        await db.SaveChangesAsync();

        var controller = BuildController(db, "ucb_demo");
        var result     = await controller.GetConfig();

        Assert.That(result, Is.InstanceOf<OkObjectResult>(), "GET should return 200 OK");
        var ok = (OkObjectResult)result;

        Assert.That(ok.Value, Is.InstanceOf<TenantConfigDto>(), "Value should be TenantConfigDto");
        var dto = (TenantConfigDto)ok.Value!;

        Assert.That(dto.Name,             Is.EqualTo("UCB Demo Bank"));
        Assert.That(dto.BankPhone,        Is.EqualTo("+91-9876543210"));
        Assert.That(dto.FeatureGoldLoan,  Is.False);
        Assert.That(dto.FeatureDynamicForms, Is.True);
    }

    // ── T-03: PUT updates flags, GET reflects them ────────────────────────────

    [Test]
    public async Task PutTenantConfig_Updates_AndReflectsOnGet()
    {
        using var db = CreateDb("put_config_test");
        db.Tenants.Add(new Tenant
        {
            Id                     = "ucb_demo",
            Name                   = "UCB Demo Bank",
            FeatureGoldLoan        = true,
            FeatureDynamicForms    = true,
            FeatureExpressions     = true,
            FeatureApprovalChain   = true,
            FeatureComplianceAlerts = false,
            FeatureFdRd            = true,
        });
        await db.SaveChangesAsync();

        var controller = BuildController(db, "ucb_demo", role: "Admin");

        // Disable Gold Loan via PUT
        var putDto = new TenantConfigDto(
            Name: null, ThemeColor: null, LogoUrl: null,
            BankAddress: null, BankPhone: null, BankEmail: null,
            RbiLicenseNumber: null, WebsiteUrl: null,
            FeatureGoldLoan: false,
            FeatureDynamicForms: true,
            FeatureExpressions: true,
            FeatureApprovalChain: true,
            FeatureComplianceAlerts: false,
            FeatureFdRd: true,
            ConfigUpdatedAt: null, ConfigUpdatedBy: null);

        var putResult = await controller.PutConfig(putDto);
        Assert.That(putResult, Is.InstanceOf<OkObjectResult>(), "PUT should return 200 OK");

        // GET should now reflect the change
        var getResult = await controller.GetConfig();
        Assert.That(getResult, Is.InstanceOf<OkObjectResult>(), "GET should return 200 OK");
        var ok = (OkObjectResult)getResult;

        Assert.That(ok.Value, Is.InstanceOf<TenantConfigDto>(), "Value should be TenantConfigDto");
        var dto = (TenantConfigDto)ok.Value!;

        Assert.That(dto.FeatureGoldLoan, Is.False, "Gold Loan should now be disabled");
        Assert.That(dto.ConfigUpdatedBy, Is.Not.Null, "ConfigUpdatedBy should be set");
    }

    // ── T-04: PUT by non-Admin returns 403 ────────────────────────────────────

    [Test]
    public async Task PutTenantConfig_Returns403_ForNonAdminUser()
    {
        using var db = CreateDb("put_forbidden_test");
        db.Tenants.Add(new Tenant
        {
            Id                     = "ucb_demo",
            Name                   = "UCB Demo Bank",
            FeatureGoldLoan        = true,
            FeatureDynamicForms    = true,
            FeatureExpressions     = true,
            FeatureApprovalChain   = true,
            FeatureComplianceAlerts = false,
            FeatureFdRd            = true,
        });
        await db.SaveChangesAsync();

        // Checker role — not Admin
        var controller = BuildController(db, "ucb_demo", role: "Checker");

        var dto = new TenantConfigDto(
            null, null, null, null, null, null, null, null,
            false, true, true, true, false, true, null, null);

        var result = await controller.PutConfig(dto);

        Assert.That(result, Is.InstanceOf<ForbidResult>(), "Checker should receive 403 Forbid");
    }
}

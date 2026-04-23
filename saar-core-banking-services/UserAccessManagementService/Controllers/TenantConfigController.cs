using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UserAccessManagementService.Models;

namespace UserAccessManagementService.Controllers
{
    [ApiController]
    [Route("api/tenant-config")]
    [Authorize]
    public class TenantConfigController : ControllerBase
    {
        private readonly UserAccessDbContext _context;

        public TenantConfigController(UserAccessDbContext context)
        {
            _context = context;
        }

        /// <summary>GET /api/tenant-config — returns bank profile + feature toggles for the caller's tenant.</summary>
        [HttpGet]
        public async Task<IActionResult> GetConfig()
        {
            var tenantId = User.FindFirst("tenant_id")?.Value ?? "public";
            var tenant   = await _context.Tenants.FindAsync(tenantId);

            if (tenant == null)
                return NotFound(new { error = $"Tenant '{tenantId}' not found." });

            return Ok(MapToDto(tenant));
        }

        /// <summary>PUT /api/tenant-config — updates bank profile + feature toggles (Admin only).</summary>
        [HttpPut]
        public async Task<IActionResult> PutConfig([FromBody] TenantConfigDto dto)
        {
            // Explicit role check for unit-testability (attribute also enforces at middleware level)
            if (!User.IsInRole("Admin"))
                return Forbid();

            var tenantId = User.FindFirst("tenant_id")?.Value ?? "public";
            var tenant   = await _context.Tenants.FindAsync(tenantId);

            if (tenant == null)
                return NotFound(new { error = $"Tenant '{tenantId}' not found." });

            // Update bank profile fields (null = unchanged)
            if (dto.Name         != null) tenant.Name            = dto.Name;
            if (dto.ThemeColor   != null) tenant.ThemeColor       = dto.ThemeColor;
            if (dto.LogoUrl      != null) tenant.LogoUrl          = dto.LogoUrl;
            if (dto.BankAddress  != null) tenant.BankAddress      = dto.BankAddress;
            if (dto.BankPhone    != null) tenant.BankPhone        = dto.BankPhone;
            if (dto.BankEmail    != null) tenant.BankEmail        = dto.BankEmail;
            if (dto.RbiLicenseNumber != null) tenant.RbiLicenseNumber = dto.RbiLicenseNumber;
            if (dto.WebsiteUrl   != null) tenant.WebsiteUrl       = dto.WebsiteUrl;

            // Feature toggles (always update — booleans can't be null-checked for "unchanged")
            tenant.FeatureGoldLoan         = dto.FeatureGoldLoan;
            tenant.FeatureDynamicForms     = dto.FeatureDynamicForms;
            tenant.FeatureExpressions      = dto.FeatureExpressions;
            tenant.FeatureApprovalChain    = dto.FeatureApprovalChain;
            tenant.FeatureComplianceAlerts = dto.FeatureComplianceAlerts;
            tenant.FeatureFdRd             = dto.FeatureFdRd;

            // Audit
            tenant.ConfigUpdatedAt = DateTime.UtcNow;
            tenant.ConfigUpdatedBy = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                                     ?? User.FindFirst("email")?.Value
                                     ?? "system";

            await _context.SaveChangesAsync();

            return Ok(MapToDto(tenant));
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private static TenantConfigDto MapToDto(Tenant t) => new(
            t.Name,
            t.ThemeColor,
            t.LogoUrl,
            t.BankAddress,
            t.BankPhone,
            t.BankEmail,
            t.RbiLicenseNumber,
            t.WebsiteUrl,
            t.FeatureGoldLoan,
            t.FeatureDynamicForms,
            t.FeatureExpressions,
            t.FeatureApprovalChain,
            t.FeatureComplianceAlerts,
            t.FeatureFdRd,
            t.ConfigUpdatedAt,
            t.ConfigUpdatedBy
        );
    }

    public record TenantConfigDto(
        string?   Name,
        string?   ThemeColor,
        string?   LogoUrl,
        string?   BankAddress,
        string?   BankPhone,
        string?   BankEmail,
        string?   RbiLicenseNumber,
        string?   WebsiteUrl,
        bool      FeatureGoldLoan,
        bool      FeatureDynamicForms,
        bool      FeatureExpressions,
        bool      FeatureApprovalChain,
        bool      FeatureComplianceAlerts,
        bool      FeatureFdRd,
        DateTime? ConfigUpdatedAt,
        string?   ConfigUpdatedBy
    );
}

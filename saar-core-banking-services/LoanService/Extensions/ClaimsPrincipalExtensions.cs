using System.Security.Claims;

namespace LoanService.Extensions
{
    /// <summary>
    /// Extension methods for ClaimsPrincipal to read feature flag claims embedded in JWT.
    /// Fail-open: if the named claim is absent, the feature is treated as enabled.
    /// (SAAR-CFG-001 — FR-CFG-004 / FR-CFG-007)
    /// </summary>
    public static class ClaimsPrincipalExtensions
    {
        /// <summary>
        /// Returns true when the feature is enabled for this user's tenant.
        /// The claim name is built as "feature_{featureName}" (e.g. "feature_gold_loan").
        /// Missing claim → fail-open → returns true.
        /// </summary>
        public static bool HasFeature(this ClaimsPrincipal user, string featureName)
        {
            var val = user.FindFirst($"feature_{featureName}")?.Value;
            // Fail-open: absent claim or any value other than "false" → enabled
            return val == null || val != "false";
        }
    }
}

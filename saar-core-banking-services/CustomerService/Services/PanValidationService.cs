using System.Text.RegularExpressions;

namespace CustomerService.Services
{
    /// <summary>
    /// Pure-logic service for Indian document number validation.
    /// No external calls — safe to use in unit tests without a DB.
    /// </summary>
    public static class PanValidationService
    {
        // PAN format: AAAAA9999A (5 uppercase letters, 4 digits, 1 uppercase letter)
        private static readonly Regex PanRegex = new Regex(@"^[A-Z]{5}[0-9]{4}[A-Z]$", RegexOptions.Compiled);

        // Aadhaar: 12 digits, first digit 2–9 (UIDAI specification)
        private static readonly Regex AadhaarRegex = new Regex(@"^[2-9][0-9]{11}$", RegexOptions.Compiled);

        // 4th character of PAN encodes the entity type
        private static readonly Dictionary<char, string> EntityTypeMap = new()
        {
            ['P'] = "Individual",
            ['C'] = "Company / Private Limited",
            ['H'] = "Hindu Undivided Family (HUF)",
            ['F'] = "Firm / LLP",
            ['A'] = "Association of Persons (AOP)",
            ['T'] = "Trust",
            ['B'] = "Body of Individuals (BOI)",
            ['L'] = "Local Authority",
            ['J'] = "Artificial Juridical Person",
            ['G'] = "Government",
        };

        // ── PAN Validation ────────────────────────────────────────────────────

        public static PanValidationResult ValidatePan(string? pan)
        {
            if (string.IsNullOrWhiteSpace(pan))
                return new PanValidationResult { IsValid = false, Error = "PAN is required." };

            var normalized = pan.Trim().ToUpperInvariant();

            if (!PanRegex.IsMatch(normalized))
                return new PanValidationResult
                {
                    IsValid       = false,
                    NormalizedPan = normalized,
                    Error         = "PAN must be 10 characters: 5 uppercase letters, 4 digits, 1 uppercase letter (e.g. ABCDE1234F).",
                };

            var entityChar  = normalized[3];
            var entityType  = EntityTypeMap.GetValueOrDefault(entityChar, $"Unknown (code {entityChar})");

            return new PanValidationResult
            {
                IsValid           = true,
                NormalizedPan     = normalized,
                HolderInitial     = normalized[4],          // 5th char = first letter of holder name
                EntityTypeCode    = entityChar,
                EntityType        = entityType,
                AssessingOfficerCode = normalized[0..3],   // first 3 chars = AO code
            };
        }

        // ── Aadhaar Validation ────────────────────────────────────────────────

        public static AadhaarValidationResult ValidateAadhaar(string? uid)
        {
            if (string.IsNullOrWhiteSpace(uid))
                return new AadhaarValidationResult { IsValid = false, Error = "Aadhaar UID is required." };

            // Strip spaces (UIDAI allows "XXXX XXXX XXXX" format)
            var digits = uid.Trim().Replace(" ", "").Replace("-", "");

            if (!AadhaarRegex.IsMatch(digits))
            {
                if (digits.Length != 12)
                    return new AadhaarValidationResult { IsValid = false, Error = $"Aadhaar must be 12 digits (got {digits.Length})." };
                if (digits[0] == '0' || digits[0] == '1')
                    return new AadhaarValidationResult { IsValid = false, Error = "Aadhaar cannot start with 0 or 1." };
                return new AadhaarValidationResult { IsValid = false, Error = "Aadhaar must contain only digits." };
            }

            // Mask: show only last 4 digits (UIDAI masking standard)
            var masked = $"XXXX-XXXX-{digits[8..]}";

            return new AadhaarValidationResult
            {
                IsValid   = true,
                MaskedUid = masked,
                LastFour  = digits[8..],
            };
        }
    }

    // ── Result DTOs ───────────────────────────────────────────────────────────

    public class PanValidationResult
    {
        public bool IsValid { get; set; }
        public string? NormalizedPan { get; set; }
        public string? AssessingOfficerCode { get; set; }
        public char EntityTypeCode { get; set; }
        public string? EntityType { get; set; }
        public char HolderInitial { get; set; }
        public string? Error { get; set; }
    }

    public class AadhaarValidationResult
    {
        public bool IsValid { get; set; }
        public string? MaskedUid { get; set; }
        public string? LastFour { get; set; }
        public string? Error { get; set; }
    }
}

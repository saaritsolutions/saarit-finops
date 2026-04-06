using LoanService.Data;
using LoanService.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace LoanService.Controllers
{
    [ApiController]
    [Route("api/loan-products")]
    public class LoanProductController : ControllerBase
    {
        private readonly LoanDbContext _db;

        public LoanProductController(LoanDbContext db)
        {
            _db = db;
        }

        /// <summary>List all active loan products.</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<LoanProductDto>>> GetAll()
        {
            var products = await _db.LoanProducts
                .Where(p => p.IsActive)
                .OrderBy(p => p.Name)
                .ToListAsync();
            return Ok(products.Select(ToDto));
        }

        /// <summary>Get a single product by code (e.g. PERSONAL_LOAN).</summary>
        [HttpGet("{productCode}")]
        public async Task<ActionResult<LoanProductDto>> GetByCode(string productCode)
        {
            var product = await _db.LoanProducts
                .FirstOrDefaultAsync(p => p.ProductCode == productCode.ToUpperInvariant() && p.IsActive);
            return product == null ? NotFound() : Ok(ToDto(product));
        }

        /// <summary>Get document checklist for a product.</summary>
        [HttpGet("{productCode}/checklist")]
        public async Task<ActionResult<DocumentChecklistDto>> GetChecklist(string productCode)
        {
            var product = await _db.LoanProducts
                .FirstOrDefaultAsync(p => p.ProductCode == productCode.ToUpperInvariant() && p.IsActive);
            if (product == null) return NotFound();

            var codes = string.IsNullOrEmpty(product.DocumentChecklistJson)
                ? Array.Empty<string>()
                : JsonSerializer.Deserialize<string[]>(product.DocumentChecklistJson) ?? Array.Empty<string>();

            var items = codes.Select(code => new DocumentChecklistItem
            {
                DocumentType = code,
                DocumentLabel = GetDocumentLabel(code),
                IsMandatory = GetIsMandatory(code, productCode),
                AcceptedFormats = GetAcceptedFormats(code),
            }).ToList();

            return Ok(new DocumentChecklistDto
            {
                ProductCode = product.ProductCode,
                ProductName = product.Name,
                Items = items,
            });
        }

        private static LoanProductDto ToDto(LoanProduct p) => new()
        {
            Id = p.Id,
            ProductCode = p.ProductCode,
            Name = p.Name,
            Description = p.Description,
            Category = p.Category,
            MinAmount = p.MinAmount,
            MaxAmount = p.MaxAmount,
            MinTenureMonths = p.MinTenureMonths,
            MaxTenureMonths = p.MaxTenureMonths,
            BaseRatePercent = p.BaseRatePercent,
            MaxRatePercent = p.MaxRatePercent,
            ProcessingFeePercent = p.ProcessingFeePercent,
            MinCibilScore = p.MinCibilScore,
            MinMonthlyIncome = p.MinMonthlyIncome,
            MaxFoirPercent = p.MaxFoirPercent,
            MaxLtvPercent = p.MaxLtvPercent,
            RequiresCollateral = p.RequiresCollateral,
            AllowsCoApplicant = p.AllowsCoApplicant,
        };

        private static string GetDocumentLabel(string code) => code switch
        {
            "PAN_CARD"          => "PAN Card",
            "AADHAAR"           => "Aadhaar Card",
            "SALARY_SLIP_3M"    => "Salary Slips (Last 3 months)",
            "BANK_STATEMENT_6M" => "Bank Statement (Last 6 months)",
            "ITR_2Y"            => "Income Tax Returns (Last 2 years)",
            "FORM_16"           => "Form 16 / Form 16A",
            "PROPERTY_DOCS"     => "Property Documents / Title Deed",
            "VEHICLE_RC"        => "Vehicle RC / Quotation",
            "GOLD_RECEIPT"      => "Gold Receipt / Valuation Certificate",
            "GST_CERTIFICATE"   => "GST Registration Certificate",
            "BUSINESS_PROOF"    => "Business Proof (Udyam / MOA)",
            "PHOTO"             => "Passport Size Photograph",
            "SIGNATURE"         => "Signature on Plain Paper",
            _                   => code,
        };

        private static bool GetIsMandatory(string code, string productCode) => code switch
        {
            "PAN_CARD" or "AADHAAR" or "PHOTO" or "SIGNATURE" => true,
            "GOLD_RECEIPT" => productCode == "GOLD_LOAN",
            "PROPERTY_DOCS" => productCode == "HOME_LOAN",
            _ => true,
        };

        private static string[] GetAcceptedFormats(string code) => code switch
        {
            "PHOTO"     => new[] { "image/jpeg", "image/png" },
            "SIGNATURE" => new[] { "image/jpeg", "image/png", "application/pdf" },
            _           => new[] { "application/pdf", "image/jpeg", "image/png" },
        };
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────
    public class LoanProductDto
    {
        public Guid Id { get; set; }
        public string ProductCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Category { get; set; } = string.Empty;
        public decimal MinAmount { get; set; }
        public decimal MaxAmount { get; set; }
        public int MinTenureMonths { get; set; }
        public int MaxTenureMonths { get; set; }
        public decimal BaseRatePercent { get; set; }
        public decimal MaxRatePercent { get; set; }
        public decimal ProcessingFeePercent { get; set; }
        public int MinCibilScore { get; set; }
        public decimal MinMonthlyIncome { get; set; }
        public decimal MaxFoirPercent { get; set; }
        public decimal MaxLtvPercent { get; set; }
        public bool RequiresCollateral { get; set; }
        public bool AllowsCoApplicant { get; set; }
    }

    public class DocumentChecklistDto
    {
        public string ProductCode { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public List<DocumentChecklistItem> Items { get; set; } = new();
    }

    public class DocumentChecklistItem
    {
        public string DocumentType { get; set; } = string.Empty;
        public string DocumentLabel { get; set; } = string.Empty;
        public bool IsMandatory { get; set; }
        public string[] AcceptedFormats { get; set; } = Array.Empty<string>();
    }
}

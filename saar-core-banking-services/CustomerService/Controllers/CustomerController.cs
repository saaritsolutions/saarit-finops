using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CustomerService.Data;
using CustomerService.Models;
using CustomerService.Services;

namespace CustomerService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CustomerController : ControllerBase
    {
        private readonly CustomerDbContext _context;
        public CustomerController(CustomerDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<CustomerListResponse>> GetCustomers(
            [FromQuery] string? search = null,
            [FromQuery] string? kycStatus = null,
            [FromQuery] string? customerType = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var query = _context.Customers.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(c =>
                    (c.FirstName  != null && c.FirstName.ToLower().Contains(s))  ||
                    (c.LastName   != null && c.LastName.ToLower().Contains(s))   ||
                    (c.Mobile     != null && c.Mobile.Contains(s))               ||
                    (c.Email      != null && c.Email.ToLower().Contains(s))      ||
                    (c.PAN        != null && c.PAN.ToLower().Contains(s)));
            }

            if (!string.IsNullOrWhiteSpace(kycStatus) && kycStatus != "ALL"
                && int.TryParse(kycStatus, out var kycInt))
                query = query.Where(c => (int)c.KycStatus == kycInt);

            if (!string.IsNullOrWhiteSpace(customerType) && customerType != "ALL")
                query = query.Where(c => c.CustomerType == customerType);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(c => c.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new CustomerListResponse(total, items, page, pageSize));
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Customer>> GetCustomer(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound();
            return customer;
        }

        [HttpPost]
        public async Task<ActionResult<Customer>> CreateCustomer(Customer customer)
        {
            if (!string.IsNullOrEmpty(customer.PAN) && _context.Customers.Any(c => c.PAN == customer.PAN))
                return BadRequest("A customer with this PAN already exists.");
            if (!string.IsNullOrEmpty(customer.UID) && _context.Customers.Any(c => c.UID == customer.UID))
                return BadRequest("A customer with this UID already exists.");
            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetCustomer), new { id = customer.CustomerId }, customer);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCustomer(int id, Customer customer)
        {
            if (id != customer.CustomerId) return BadRequest();
            var existing = await _context.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.CustomerId == id);
            if (existing == null) return NotFound();
            customer.CreatedBy = existing.CreatedBy;
            customer.CreatedAt = existing.CreatedAt;
            customer.ApprovalStatus = "Pending";
            customer.ApprovedBy = null;
            customer.ApprovedAt = null;
            _context.Entry(customer).State = EntityState.Modified;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Customers.Any(e => e.CustomerId == id))
                    return NotFound();
                else
                    throw;
            }
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCustomer(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound();
            _context.Customers.Remove(customer);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ── Document Validation ───────────────────────────────────────────────
        // Always 200 OK with { isValid, message } so the frontend never has to
        // catch an HTTP error just to read a validation failure message.

        [HttpPost("validate/pan")]
        public IActionResult ValidatePan([FromBody] ValidateDocumentRequest request)
        {
            var result = PanValidationService.ValidatePan(request.Value);
            return Ok(new
            {
                isValid = result.IsValid,
                message = result.IsValid
                    ? $"Valid PAN — {result.EntityType} (holder initial: {result.HolderInitial})"
                    : result.Error,
            });
        }

        [HttpPost("validate/aadhaar")]
        public IActionResult ValidateAadhaar([FromBody] ValidateDocumentRequest request)
        {
            var result = PanValidationService.ValidateAadhaar(request.Value);
            return Ok(new
            {
                isValid = result.IsValid,
                message = result.IsValid
                    ? $"Valid Aadhaar — masked: {result.MaskedUid}"
                    : result.Error,
            });
        }

        // ── KYC Workflow ──────────────────────────────────────────────────────────
        // State machine: NotStarted(0)→InProgress(1)→DocumentsSubmitted(2)→Verified(3)
        //                InProgress(1)|DocumentsSubmitted(2)→Rejected(4)
        //                Verified(3)→Expired(5)

        [HttpPost("{id}/kyc/initiate")]
        public async Task<IActionResult> KycInitiate(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound();
            if (customer.KycStatus != KycStatus.NotStarted)
                return UnprocessableEntity($"KYC can only be initiated from NotStarted state (current: {customer.KycStatus}).");
            customer.KycStatus = KycStatus.InProgress;
            await _context.SaveChangesAsync();
            return Ok(new { kycStatus = (int)customer.KycStatus, message = "KYC initiated successfully." });
        }

        [HttpPost("{id}/kyc/submit-documents")]
        public async Task<IActionResult> KycSubmitDocuments(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound();
            if (customer.KycStatus != KycStatus.InProgress)
                return UnprocessableEntity($"KYC must be In Progress to submit documents (current: {customer.KycStatus}).");
            customer.KycStatus = KycStatus.DocumentsSubmitted;
            await _context.SaveChangesAsync();
            return Ok(new { kycStatus = (int)customer.KycStatus, message = "Documents submitted for KYC review." });
        }

        [HttpPost("{id}/kyc/verify")]
        public async Task<IActionResult> KycVerify(int id, [FromBody] KycVerifyRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.VerifiedBy))
                return BadRequest("VerifiedBy is required.");
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound();
            if (customer.KycStatus != KycStatus.DocumentsSubmitted)
                return UnprocessableEntity($"KYC must be in DocumentsSubmitted state to verify (current: {customer.KycStatus}).");
            customer.KycStatus = KycStatus.Verified;
            customer.KycVerifiedAt = DateTime.UtcNow;
            customer.KycVerifiedBy = request.VerifiedBy;
            customer.KycRejectionReason = null;
            await _context.SaveChangesAsync();
            return Ok(new { kycStatus = (int)customer.KycStatus, message = $"KYC verified by {request.VerifiedBy}." });
        }

        [HttpPost("{id}/kyc/reject")]
        public async Task<IActionResult> KycReject(int id, [FromBody] KycRejectRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.RejectionReason))
                return BadRequest("RejectionReason is required.");
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound();
            if (customer.KycStatus != KycStatus.InProgress && customer.KycStatus != KycStatus.DocumentsSubmitted)
                return UnprocessableEntity($"KYC can only be rejected from InProgress or DocumentsSubmitted state (current: {customer.KycStatus}).");
            customer.KycStatus = KycStatus.Rejected;
            customer.KycRejectionReason = request.RejectionReason;
            await _context.SaveChangesAsync();
            return Ok(new { kycStatus = (int)customer.KycStatus, message = "KYC rejected." });
        }

        [HttpPost("{id}/kyc/expire")]
        public async Task<IActionResult> KycExpire(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound();
            if (customer.KycStatus != KycStatus.Verified)
                return UnprocessableEntity($"Only Verified KYC can be expired (current: {customer.KycStatus}).");
            customer.KycStatus = KycStatus.Expired;
            await _context.SaveChangesAsync();
            return Ok(new { kycStatus = (int)customer.KycStatus, message = "KYC expired — re-KYC required." });
        }

        [HttpPost("{id}/kyc/mark-incomplete")]
        public async Task<IActionResult> KycMarkIncomplete(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound();
            if (customer.KycStatus != KycStatus.DocumentsSubmitted)
                return UnprocessableEntity($"Only DocumentsSubmitted KYC can be marked incomplete (current: {customer.KycStatus}).");
            customer.KycStatus = KycStatus.InProgress;
            customer.KycRejectionReason = null;
            await _context.SaveChangesAsync();
            return Ok(new { kycStatus = (int)customer.KycStatus, message = "KYC marked as incomplete. Please re-upload documents." });
        }

        // ── Document Upload ───────────────────────────────────────────────────
        // Simple file upload endpoint that accepts KYC documents.
        // In a production system, files would be stored in cloud storage (S3, Azure Blob, etc.)
        // For now, we just validate the upload and return success.

        [HttpPost("{id}/documents/upload")]
        public async Task<IActionResult> UploadDocument(int id, [FromForm] IFormFile file, [FromForm] string? documentType)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound();

            if (file == null || file.Length == 0)
                return BadRequest("No file provided.");

            if (file.Length > 5 * 1024 * 1024) // 5MB limit
                return BadRequest("File size exceeds 5MB limit.");

            var allowedExtensions = new[] { ".pdf", ".jpg", ".jpeg", ".png" };
            var fileExtension = Path.GetExtension(file.FileName).ToLower();
            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest("Invalid file type. Allowed: PDF, JPG, PNG.");

            // In production, save to cloud storage here
            // For now, just validate and return success
            return Ok(new { message = $"Document '{file.FileName}' uploaded successfully." });
        }
    }

    public record ValidateDocumentRequest(string? Value);
    public record KycVerifyRequest(string? VerifiedBy);
    public record KycRejectRequest(string? RejectionReason);
    public record CustomerListResponse(int Total, List<Customer> Items, int Page, int PageSize);
}

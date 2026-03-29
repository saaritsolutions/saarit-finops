# ADR-007: Security Framework

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-03-29 |
| Deciders | SaaR Architecture Team |
| Regulatory Ref | IDRBT Annexure II — Access control, session management, encryption, VAPT; RBI IT Framework 2011 |

---

## Context

Banking systems are high-value targets. IDRBT explicitly mandates:
- Role-based access control (RBAC) with function-level permissions
- 3-minute inactivity auto-logout
- Single active session per user
- All actions logged with user identity, timestamp, and IP
- PII data encrypted at rest and in transit
- Password complexity + 90-day rotation
- VAPT (Vulnerability Assessment and Penetration Testing) by CERT-IN empanelled agency annually
- Two-factor authentication for admin and privileged users
- No direct database access from application (parameterized queries only)

---

## Decision: Defence-in-Depth Security Model

### Security Layers
```
Layer 1: Network      → TLS 1.3 everywhere, no plain HTTP in production
Layer 2: API Gateway  → JWT validation, rate limiting, IP allowlist for admin
Layer 3: Application  → RBAC authorization, maker-checker enforcement
Layer 4: Data         → Column-level encryption, parameterized queries
Layer 5: Audit        → Immutable log of every access and change
Layer 6: Operations   → Secrets management, container image scanning
```

---

## Authentication: JWT with Refresh Token Rotation

### Token Design
```json
{
  "sub": "USR001",
  "name": "Rajesh Kumar",
  "bank_id": "KL001UCB",
  "branch_id": "BR001",
  "roles": ["TELLER"],
  "permissions": ["ACCOUNT_VIEW", "CASH_DEPOSIT", "CASH_WITHDRAWAL"],
  "transaction_limit": 50000,
  "session_id": "sess_abc123",
  "iat": 1711699200,
  "exp": 1711699380   // 3-minute expiry (IDRBT requirement)
}
```

### Token Lifecycle
```
Login (POST /api/identity/login)
  ↓ Validate credentials + 2FA (if enabled)
  ↓ Generate: Access Token (3 min) + Refresh Token (8 hours)
  ↓ Store session in Redis: session:{userId}:{sessionId} → { ip, userAgent, createdAt }
  ↓ Return tokens to client

Every API call:
  → Client sends Bearer {access_token}
  → Middleware validates JWT signature
  → Middleware checks session not revoked (Redis lookup)
  → Middleware sets HttpContext.User with claims

Token refresh (POST /api/identity/refresh):
  → Validate refresh token (not expired, not revoked)
  → Issue new access token + new refresh token (rotation)
  → Revoke old refresh token

Logout / inactivity:
  → Delete session from Redis
  → Old tokens become invalid on next request
```

### Single Active Session Enforcement
```csharp
public async Task<LoginResult> LoginAsync(LoginRequest req)
{
    // Check if user already has an active session
    var existingSession = await _cache.GetAsync($"session:{req.UserId}:*");
    if (existingSession != null)
    {
        // Enforce single session: revoke existing session
        await _cache.RemoveAsync(existingSession.SessionKey);
        await _auditService.Log("FORCED_LOGOUT", req.UserId, "New login from different device");
    }
    // Create new session
}
```

---

## Authorization: RBAC with Financial Power Limits

### Role Hierarchy
```
SUPER_ADMIN (SaaR operations — cross-bank)
└── BANK_ADMIN (per bank — full access to own bank)
    ├── BRANCH_MANAGER
    │   ├── OFFICER
    │   │   └── TELLER (most restricted)
    ├── AUDITOR (read-only, all branches)
    ├── PARAM_ADMIN (parameter changes, with maker-checker)
    └── REPORT_USER (MIS reports, no transactions)
```

### Permission Matrix (IDRBT Functional Requirements)
| Action | TELLER | OFFICER | BRANCH_MANAGER | AUDITOR |
|---|---|---|---|---|
| View account balance | ✓ | ✓ | ✓ | ✓ |
| Cash deposit (own branch) | ✓ (up to limit) | ✓ | ✓ | ✗ |
| Cash withdrawal (own branch) | ✓ (up to limit) | ✓ | ✓ | ✗ |
| Approve transactions > ₹50,000 | ✗ | ✓ (up to ₹1L) | ✓ (up to ₹5L) | ✗ |
| Open new account | ✓ (make) | ✓ (check) | ✓ | ✗ |
| Sanction loan | ✗ | ✓ (make) | ✓ (check) | ✗ |
| Change interest rate | ✗ | ✗ | ✓ (make) | ✗ |
| View audit trail | ✗ | ✗ | ✓ | ✓ |
| Generate RBI report | ✗ | ✗ | ✓ | ✓ |

### Financial Power Limits (branch-scoped)
```csharp
[Authorize]
[RequirePermission("CASH_WITHDRAWAL")]
public async Task<IActionResult> WithdrawAsync(WithdrawalRequest req)
{
    var user = HttpContext.GetBankingUser();

    // Check amount against user's power limit
    if (req.Amount > user.TransactionLimit)
        return Unauthorized("Amount exceeds your transaction power limit");

    // Check branch scope (Teller can only transact at their branch)
    if (req.BranchId != user.BranchId && !user.HasPermission("CROSS_BRANCH"))
        return Forbidden("You can only process transactions at your assigned branch");

    // If above maker-checker threshold: create pending transaction (not immediate)
    var makerCheckerThreshold = await _params.GetDecimalAsync("workflow.maker_checker_threshold");
    if (req.Amount > makerCheckerThreshold)
        return await _workflow.CreatePendingAsync(req, user.Id);

    return await _transactionService.ProcessAsync(req);
}
```

---

## Maker-Checker Implementation

IDRBT Section 15: "All financial transactions must be authorized by a second person (the Checker) before posting."

```
State Machine:
  DRAFT → PENDING_CHECK → APPROVED → POSTED
       ↘               ↘
         CANCELLED       REJECTED

Rules:
  1. Maker and Checker must be different persons
  2. Checker must have equal or higher role than Maker
  3. Checker cannot check transactions created by themselves
  4. Time limit: checker must act within 4 hours, else auto-expired
  5. Amendment: if Maker amends, Checker must re-approve
```

```csharp
public async Task<CheckResult> CheckTransactionAsync(Guid txnId, string checkerId, bool approve)
{
    var txn = await _db.PendingTransactions.FindAsync(txnId);

    if (txn.CreatedBy == checkerId)
        throw new BusinessException("Maker and Checker cannot be the same person");

    if (txn.Status != TransactionStatus.PendingCheck)
        throw new BusinessException("Transaction is not pending check");

    if (approve)
    {
        txn.Status = TransactionStatus.Approved;
        txn.CheckedBy = checkerId;
        txn.CheckedAt = DateTime.UtcNow;
        await _transactionService.PostAsync(txn);
    }
    else
    {
        txn.Status = TransactionStatus.Rejected;
        txn.RejectionReason = req.Reason;
    }

    await _auditService.LogMakerChecker(txn, checkerId, approve);
}
```

---

## PII Encryption

### Encrypted Fields
| Field | Encryption Method | Searchable? |
|---|---|---|
| Aadhaar number | AES-256 (application layer) | No — use tokenized reference |
| PAN number | AES-256 (application layer) | By exact match only (hash index) |
| Mobile number | AES-256 | Last 4 digits stored plaintext |
| Account number | Not encrypted (non-PII) | Yes |
| Name | Not encrypted | FTS (trigram index) |

```csharp
// Encryption at application layer (not DB)
public class PiiEncryptionService
{
    private readonly byte[] _key; // from Azure Key Vault / AWS Secrets Manager

    public string Encrypt(string plaintext)
        => Convert.ToBase64String(AesGcm.Encrypt(_key, Encoding.UTF8.GetBytes(plaintext)));

    public string Decrypt(string ciphertext)
        => Encoding.UTF8.GetString(AesGcm.Decrypt(_key, Convert.FromBase64String(ciphertext)));

    public string Mask(string plaintext, int visibleChars = 4)
        => new string('*', plaintext.Length - visibleChars) + plaintext[^visibleChars..];
}
```

### Key Management
```
Key storage: Azure Key Vault (India region) / HashiCorp Vault (on-prem option)
Key rotation: Annual (IDRBT best practice)
Key per tenant: each bank has its own encryption key (data isolation guarantee)
Key backup: split knowledge (no single person has full key)
```

---

## Session Management (IDRBT Requirements)

```
Session timeout: 3 minutes of inactivity → auto-logout
Single session: logging in from Device B automatically revokes Device A session
Session binding: session tied to IP + User-Agent (change = forced re-auth)
Concurrent access: disallowed for privileged roles (MANAGER, ADMIN)
Holiday access: branch operations locked on bank holidays (configurable per bank)
Time-bound access: Teller login only during banking hours (configurable per bank)
```

---

## API Security

### Rate Limiting (Redis-backed)
```csharp
// Prevent brute-force on login
[RateLimit("login", maxRequests: 5, windowSeconds: 300)]  // 5 attempts per 5 min
public async Task<IActionResult> LoginAsync(LoginRequest req) { }

// Prevent API abuse
[RateLimit("transaction", maxRequests: 100, windowSeconds: 60)] // 100 txns/min per user
public async Task<IActionResult> TransferAsync(TransferRequest req) { }
```

### Input Validation (OWASP Top 10 Defence)
```csharp
// FluentValidation rules — all inputs validated before reaching domain
public class TransferRequestValidator : AbstractValidator<TransferRequest>
{
    public TransferRequestValidator()
    {
        RuleFor(r => r.Amount)
            .GreaterThan(0).WithMessage("Amount must be positive")
            .LessThanOrEqualTo(10_000_000).WithMessage("Single transfer limit is ₹1 crore");

        RuleFor(r => r.ToAccountNumber)
            .Matches(@"^\d{9,18}$").WithMessage("Invalid account number format")
            .Must(NotContainSqlInjection);  // defence in depth

        RuleFor(r => r.Narration)
            .MaximumLength(100)
            .Must(n => !n.Contains("<script>"));  // XSS defence
    }
}
```

### Security Headers (nginx config)
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Content-Security-Policy "default-src 'self'" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

## Audit Trail Requirements

Every action in the system generates an immutable audit record:
```csharp
public class AuditEntry
{
    public Guid Id { get; set; }
    public string UserId { get; set; }
    public string BankId { get; set; }
    public string BranchId { get; set; }
    public string Action { get; set; }          // e.g., "CASH_WITHDRAWAL"
    public string EntityType { get; set; }      // e.g., "Account"
    public string EntityId { get; set; }
    public JsonDocument OldValues { get; set; } // field-level before values
    public JsonDocument NewValues { get; set; } // field-level after values
    public string IpAddress { get; set; }
    public string UserAgent { get; set; }
    public DateTime Timestamp { get; set; }
    public bool IsSuccess { get; set; }
    public string ErrorCode { get; set; }       // if failed
}
```

Audit entries are **never deleted** and are stored in a separate AuditService database (separate schema, separate connection, write-only from application).

---

## Consequences

### Positive
- Meets all IDRBT Annexure II security requirements
- Maker-checker is enforced at the platform level, not as an optional feature
- JWT + Redis session management enables easy revocation
- Field-level audit trail satisfies RBI inspection requirements

### Negative / Mitigations
- **Risk:** 3-minute JWT expiry causes frequent token refresh calls
  - **Mitigation:** Client-side silent refresh (refresh 30 seconds before expiry)
- **Risk:** Per-tenant encryption keys increase complexity
  - **Mitigation:** Key Vault SDK abstracts key management; no application code handles raw keys
- **Risk:** VAPT findings after deployment
  - **Mitigation:** Schedule VAPT during UAT phase; budget for remediation sprints

---

## Related Decisions
- ADR-002: Service Decomposition (IdentityService is a standalone service)
- ADR-005: Parametrization (maker-checker threshold is a bank parameter)
- ADR-004: Event Architecture (all authentication events produce audit domain events)

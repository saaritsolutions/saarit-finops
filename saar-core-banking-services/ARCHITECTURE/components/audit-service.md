# AuditService

## Purpose
Immutable, append-only audit trail for all system actions. Captures every state change, login event, and financial transaction with full field-level history for RBI regulatory inspection.

## Port
`:5016`

## Design Principle
- **Write-only from application:** Core Banking writes audit entries; never reads them back for business logic
- **Separate database connection:** Even if CoreBankingApi is compromised, audit DB remains intact
- **Never deleted:** No DELETE or UPDATE statements allowed on audit_log table — enforced at DB level
- **Always available:** AuditService is deployed in a different availability zone from CoreBankingApi

## Responsibilities
- Receive and persist audit events from all services
- Field-level change tracking (before/after values for every update)
- User activity log (login, logout, failed attempts)
- Financial transaction audit (every posting with GL impact)
- Parameter change audit
- Maker-Checker decision audit
- Provide audit report API (for auditors and RBI inspection)

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| POST | `/api/audit/log` | Write audit entry (internal only) |
| GET | `/api/audit/trail` | Query audit trail (AUDITOR role) |
| GET | `/api/audit/user/{userId}` | All actions by a specific user |
| GET | `/api/audit/account/{accountId}` | All events on an account |
| GET | `/api/audit/transaction/{txnId}` | Audit trail for a transaction |
| GET | `/api/audit/login-history` | Login/logout history |
| GET | `/api/audit/parameter-changes` | History of parameter changes |
| POST | `/api/audit/report` | Generate audit report for date range |

## Data Model
```sql
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID NOT NULL DEFAULT gen_random_uuid(),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bank_id         TEXT NOT NULL,
    branch_id       TEXT,
    user_id         TEXT NOT NULL,
    user_role       TEXT,
    action          TEXT NOT NULL,   -- e.g., CASH_DEPOSIT, LOGIN, PARAMETER_CHANGED
    entity_type     TEXT,            -- Account, Customer, LoanApplication...
    entity_id       TEXT,
    old_values      JSONB,           -- Field values BEFORE change
    new_values      JSONB,           -- Field values AFTER change
    amount          NUMERIC(18,2),   -- Monetary amount (if applicable)
    ip_address      INET,
    user_agent      TEXT,
    session_id      TEXT,
    is_success      BOOLEAN NOT NULL,
    error_code      TEXT,
    error_message   TEXT,
    metadata        JSONB            -- Additional context
) PARTITION BY RANGE (occurred_at);   -- Monthly partitions

-- Row-level security: each bank can only see their own audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_bank_isolation ON audit_log
    USING (bank_id = current_setting('app.bank_id'));

-- Prevent deletion at DB level
CREATE RULE no_delete_audit AS ON DELETE TO audit_log DO INSTEAD NOTHING;
```

## Standard Audit Events
| Event | Trigger | Fields Captured |
|---|---|---|
| `LOGIN_SUCCESS` | Successful login | userId, ip, userAgent |
| `LOGIN_FAILED` | Wrong password | userId, attemptCount, ip |
| `LOGOUT` | Manual or timeout | userId, sessionDuration |
| `CASH_DEPOSIT` | Cash deposited | accountId, amount, denominations, tellerId |
| `CASH_WITHDRAWAL` | Cash withdrawn | accountId, amount, tellerId |
| `FUND_TRANSFER` | Inter-account transfer | fromAccount, toAccount, amount |
| `ACCOUNT_OPENED` | New account created | accountId, customerId, productCode |
| `CUSTOMER_UPDATED` | Customer details changed | customerId, oldValues, newValues |
| `LOAN_SANCTIONED` | Loan approved | loanId, amount, sanctionedBy |
| `PARAMETER_CHANGED` | Bank parameter updated | paramKey, oldValue, newValue, approvedBy |
| `MAKER_CHECKER_APPROVED` | Checker approved | workflowId, makerId, checkerId, action |
| `MAKER_CHECKER_REJECTED` | Checker rejected | workflowId, makerId, checkerId, reason |

## Integration Pattern
All services publish audit events without waiting for the response:
```csharp
// Fire-and-forget audit logging (never blocks business operation)
_ = _auditService.LogAsync(new AuditEntry
{
    Action = "CASH_DEPOSIT",
    EntityType = "Account",
    EntityId = accountId.ToString(),
    Amount = request.Amount,
    NewValues = JsonDocument.Parse(JsonSerializer.Serialize(result))
});
```

## IDRBT Requirements Met
- IDRBT Annexure II: Immutable audit trail for all transactions
- IDRBT Sec 15: Maker-Checker record retained with both user IDs
- RBI IT Framework: Log retention for 10 years minimum
- RBI inspection: Auditors can query by date range, user, account, or action type

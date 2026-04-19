# Expression Engine — Wire to AccountService & TransactionService

**Ticket ID:** SAAR-EXPR-001
**Created:** 2026-04-19
**Status:** APPROVED FOR DEVELOPMENT
**Priority:** High
**Reporter:** Product Owner
**Assignee:** Engineering
**Sprint:** Session 34

---

## 1. Business Context

The ExpressionBuilderService (Roslyn-based rule engine) is **LIVE** at port 5004 and is currently
consumed only by LoanService (one active expression: `EXPR_1755237353842` for loan eligibility).

The engine is the platform's primary competitive differentiator — it allows each bank to define
their own business rules without code deployment. However, it is only wired to one of six services,
meaning all other configurable thresholds (transaction limits, NPA days, CTR triggers, fee waiver
rules) are still hard-coded constants.

**Goal:** Extend ExpressionBuilderService consumption to AccountService and TransactionService,
creating clearly defined "trigger points" where expressions are evaluated instead of hard-coded
values. This makes the rule engine visibly powerful in bank demos.

**Market impact:**
- UCB demos: show a branch manager changing a fee waiver rule in real time — no developer needed
- NBFC demos: show an NPA classification rule being updated for RBI compliance — instantly live

---

## 2. Trigger Points Per Service

### 2.1 AccountService Trigger Points

#### TP-ACC-001: Transaction Limit Check
**Trigger:** Before any debit transaction is authorised on an account.
**Purpose:** Each bank defines their own per-day, per-transaction limits.
**Expression category:** `TransactionLimit`
**Input variables:**

| Variable | Type | Description |
|----------|------|-------------|
| `amount` | decimal | Transaction amount (₹) |
| `accountType` | string | SAVINGS / CURRENT / SALARY / NRI |
| `isInternational` | bool | Domestic or cross-border |
| `dailyDebitTotal` | decimal | Sum of debits today for this account |
| `channelType` | string | BRANCH / MOBILE / INTERNET / ATM |

**Return type:** `bool` (true = allow, false = block)
**Fallback (if no expression active):** UCB default limits (₹2L/day savings, ₹5L/day current)

**Example expression (UCB demo):**
```csharp
accountType == "SAVINGS" ? (amount <= 200000m && dailyDebitTotal + amount <= 200000m) :
accountType == "CURRENT" ? (amount <= 500000m) :
true
```

**Acceptance Criteria:**
- [ ] AccountService checks for an active `TransactionLimit` expression before debiting
- [ ] If expression returns `false`: transaction rejected with HTTP 422, reason = "transaction limit exceeded"
- [ ] If ExpressionBuilderService is unreachable: fall back to hard-coded defaults (fail-open policy)
- [ ] Expression evaluation is logged (ExecutionLog in ExpressionBuilderService)
- [ ] Feature flag `FeatureFlags:EnableExpressions` controls this behaviour (consistent with LoanService)

---

#### TP-ACC-002: Account Maintenance Fee Calculation
**Trigger:** Monthly fee charging job (IHostedService or manual trigger).
**Purpose:** Banks charge different AMC based on balance tier, customer segment, account age.
**Expression category:** `FeeCalculation`
**Input variables:**

| Variable | Type | Description |
|----------|------|-------------|
| `averageMonthlyBalance` | decimal | Average balance for the month |
| `accountType` | string | SAVINGS / CURRENT |
| `accountAgeMonths` | int | Months since account opened |
| `customerSegment` | string | REGULAR / PRIORITY / SENIOR_CITIZEN / STAFF |
| `minimumBalanceRequired` | decimal | Product's minimum balance threshold |

**Return type:** `decimal` (fee amount in ₹; 0 = waive)

**Example expression (UCB demo):**
```csharp
customerSegment == "SENIOR_CITIZEN" ? 0m :
customerSegment == "STAFF" ? 0m :
averageMonthlyBalance >= minimumBalanceRequired ? 0m :
accountType == "SAVINGS" ? 50m : 100m
```

**Acceptance Criteria:**
- [ ] AccountService calls expression for fee before charging
- [ ] Result = 0 → no debit posted; result > 0 → debit posted via TransactionService
- [ ] Fee charged is logged in transaction description as "Account Maintenance Fee (expression: <exprId>)"
- [ ] Fallback: ₹50 for savings, ₹100 for current if no expression active

---

### 2.2 TransactionService Trigger Points

#### TP-TXN-001: NPA Classification Rule
**Trigger:** EOD batch — classify overdue loans/accounts per RBI IRACP norms.
**Purpose:** Each bank's NPA policy may vary slightly (RBI sets minimums; banks can be stricter).
**Expression category:** `NPAClassification`
**Input variables:**

| Variable | Type | Description |
|----------|------|-------------|
| `daysOverdue` | int | Days since last payment was due |
| `loanType` | string | GOLD_LOAN / PERSONAL / HOME / VEHICLE |
| `outstandingAmount` | decimal | Current outstanding principal |
| `isAgriculture` | bool | Agriculture loans have different IRACP norms |

**Return type:** `string` — one of: `STANDARD` / `SPECIAL_MENTION` / `SUB_STANDARD` / `DOUBTFUL` / `LOSS`

**Example expression (RBI default — UCB/NBFC):**
```csharp
daysOverdue == 0 ? "STANDARD" :
daysOverdue <= 30 ? "SPECIAL_MENTION" :
daysOverdue <= 90 ? (isAgriculture ? "SPECIAL_MENTION" : "SUB_STANDARD") :
daysOverdue <= 365 ? "DOUBTFUL" :
"LOSS"
```

**Acceptance Criteria:**
- [ ] EOD batch in TransactionService evaluates this expression per overdue account
- [ ] Result stored in `LoanAccount.NpaCategory` (existing field)
- [ ] If expression returns unexpected value: default to `SPECIAL_MENTION` (conservative fallback)
- [ ] All NPA classification runs logged with expression ID used

---

#### TP-TXN-002: CTR (Cash Transaction Report) Trigger
**Trigger:** Post-transaction — after every cash debit/credit is posted.
**Purpose:** RBI mandates CTR filing for cash transactions above ₹10L in a day. Banks may set a
lower internal threshold.
**Expression category:** `ComplianceTrigger`
**Input variables:**

| Variable | Type | Description |
|----------|------|-------------|
| `transactionAmount` | decimal | Current transaction amount |
| `dailyCashTotal` | decimal | Sum of cash txns today for this customer |
| `transactionType` | string | CASH_DEPOSIT / CASH_WITHDRAWAL |
| `customerType` | string | INDIVIDUAL / BUSINESS / TRUST |

**Return type:** `bool` (true = file CTR)

**Example expression:**
```csharp
(transactionAmount >= 1000000m) || (dailyCashTotal + transactionAmount >= 1000000m)
```

**Acceptance Criteria:**
- [ ] TransactionService calls this expression after posting cash transactions
- [ ] If true: creates a `ComplianceAlert` record (type=CTR, status=PENDING_REVIEW)
- [ ] ComplianceAlert visible to Compliance Officer role in existing UI
- [ ] Fallback: hard-coded ₹10L threshold if no expression active

---

## 3. Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| Latency | Expression evaluation must complete in < 50ms (IL cache hit) — not on critical transaction path |
| Circuit breaker | If ExpressionBuilderService is down: log warning, use hard-coded fallback (never block transactions) |
| Multi-tenancy | Expression lookup must use tenant-scoped search (each bank has own rules) |
| Feature flags | `FeatureFlags:EnableExpressions` in appsettings — consistent with LoanService pattern |
| Caching | HTTP client to ExpressionBuilderService should cache active expression IDs per category (5-min TTL) |
| Audit | Every expression evaluation call is automatically logged by ExpressionBuilderService |

---

## 4. Out of Scope

- STR (Suspicious Transaction Report) — separate compliance sprint
- Interest rate override via expression (AccountService) — Phase 2 of this ticket
- Fraud velocity checks — requires event-streaming (future sprint)
- TransactionService fee expressions (processing fee, RTGS fee) — separate ticket SAAR-EXPR-002
- UI for compliance alerts — existing ComplianceAlert UI to be wired separately

---

## 5. Architectural Decision

**Decision:** Use existing `IExpressionEvaluationService` HTTP client pattern from LoanService.
**ADR:** No new ADR needed — consistent with existing pattern (ADR-010 covers AI/expression pipeline).
**Pattern:**

```csharp
// Same pattern as LoanService/Services/ExpressionEvaluationService.cs
1. GET /api/expressions?category={category}&status=Active&tenant={tenantId}
   → find latest active expression for this category
2. POST /api/expression-engine/execute
   → { ExpressionId, Variables }
3. Handle result; fall back to hard-coded default if service unavailable
```

---

## 6. New Expression Seeds Required

The following expressions must be seeded in ExpressionBuilderService at startup
(or via the Admin UI) for the demo to work out of the box:

| Expression ID | Category | Service | Default Rule |
|---------------|----------|---------|--------------|
| `EXPR_TRANSACTION_LIMIT_UCB` | TransactionLimit | AccountService | ₹2L savings / ₹5L current |
| `EXPR_AMC_FEE_UCB` | FeeCalculation | AccountService | Waive senior citizen / staff |
| `EXPR_NPA_CLASSIFICATION` | NPAClassification | TransactionService | RBI IRACP norms (standard) |
| `EXPR_CTR_TRIGGER` | ComplianceTrigger | TransactionService | ₹10L cash in a day |

---

## 7. Data Model Changes

### AccountService
- No new entities required
- New `IExpressionClient` interface + `ExpressionClient.cs` HTTP wrapper (same as LoanService pattern)
- `appsettings.json`: add `ExpressionService:BaseUrl` and `FeatureFlags:EnableExpressions`

### TransactionService
- New `ComplianceAlert` entity (if not already present):
  ```
  ComplianceAlert { Id, TenantId, AccountId, CustomerId, AlertType (CTR/STR),
                    TransactionId, TriggerAmount, Status (PENDING/FILED/DISMISSED),
                    CreatedAt, ReviewedBy, ReviewedAt }
  ```
- New EF migration: `AddComplianceAlerts`
- New `IExpressionClient` + `appsettings.json` entries

---

## 8. API Surface

### AccountService — no new public endpoints
Expression evaluation is internal to service logic — no new REST endpoints.

### TransactionService — one new endpoint
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/compliance/alerts` | List pending CTR/STR alerts for Compliance Officer |
| PATCH | `/api/compliance/alerts/{id}` | Mark filed / dismissed |

---

## 9. Test Plan

### Unit Tests
- [ ] `AccountService_TransactionLimitCheck_BlocksWhenExpressionReturnsFalse`
- [ ] `AccountService_TransactionLimitCheck_FallsBackToDefault_WhenServiceDown`
- [ ] `AccountService_FeeCalculation_WaivesForSeniorCitizen`
- [ ] `TransactionService_NpaClassification_Returns_SubStandard_At91Days`
- [ ] `TransactionService_CTRTrigger_CreatesAlert_WhenThresholdBreached`
- [ ] `TransactionService_CTRTrigger_FallsBack_WhenExpressionServiceDown`

### Integration / Manual Test Flow
1. Ensure ExpressionBuilderService is running (port 5004)
2. Seed `EXPR_TRANSACTION_LIMIT_UCB` with ₹2L savings limit
3. POST transaction for ₹2,50,000 on savings account → expect 422
4. Update expression to allow ₹3L → POST same transaction → expect success
5. Verify expression evaluation log in ExpressionBuilderService DB
6. Seed `EXPR_NPA_CLASSIFICATION`, run EOD batch
7. Verify LoanAccount.NpaCategory updated correctly

---

## 10. Dependencies

| Dependency | Status |
|------------|--------|
| ExpressionBuilderService | LIVE (port 5004) |
| AccountService | LIVE (port 5217) |
| TransactionService | LIVE (port 5005) |
| `IExpressionEvaluationService` pattern (LoanService) | LIVE — reference implementation |
| ComplianceAlert UI | NOT built — out of scope for this ticket |

---

## 11. Implementation Phases

### Phase 1 (This Ticket)
- AccountService: TP-ACC-001 (transaction limit) + TP-ACC-002 (fee calculation)
- TransactionService: TP-TXN-001 (NPA classification) + TP-TXN-002 (CTR trigger)
- 4 seed expressions
- Unit tests for all trigger points

### Phase 2 (SAAR-EXPR-002 — future)
- AccountService: interest rate override expression
- TransactionService: STR trigger, processing fee expression
- WorkflowOrchestrationService: expression-driven routing (approval level from expression)

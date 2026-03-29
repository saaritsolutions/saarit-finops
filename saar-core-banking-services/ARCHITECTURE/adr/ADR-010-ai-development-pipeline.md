# ADR-010: AI-Assisted Development Pipeline

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-03-29 |
| Deciders | SaaR Architecture Team |
| Regulatory Ref | N/A — Internal development efficiency; supports IDRBT audit traceability |

---

## Context

SaaR CBS is a large, complex platform. Building 18 functional modules, 14 microservices, and a feature-rich React frontend manually would take years. To accelerate development while maintaining quality:

1. **AI Agents** (Claude Code, GitHub Copilot, GPT-4) should assist in writing, testing, and reviewing code
2. Requirements from the IDRBT document must translate into code without manual re-interpretation each time
3. The architecture must be structured so AI agents can reliably generate correct, consistent code

Architecture Principle P7: **AI-Assisted Development** — Structured specs drive code generation, test generation, and review.

---

## Decision: Spec-First, AI-Generated, Human-Reviewed Pipeline

### Pipeline Phases

```
Phase 1: REQUIREMENT SPEC
  Input: IDRBT requirement section + business analyst interpretation
  Output: Structured YAML requirement spec (machine-readable)

Phase 2: API SPEC
  Input: YAML requirement spec
  Output: OpenAPI 3.0 spec (endpoints, request/response schemas)

Phase 3: CODE GENERATION
  Input: OpenAPI spec + ADR context + existing code patterns
  Output: C# controller, service, domain model, EF migration

Phase 4: TEST GENERATION
  Input: OpenAPI spec + business rules from YAML spec
  Output: xUnit integration tests (happy path + edge cases + boundary conditions)

Phase 5: REVIEW
  Input: Generated code + generated tests
  Action: Human review for business logic correctness; AI review for security/patterns

Phase 6: CI/CD VALIDATION
  Input: All code + tests
  Output: Green build → deploy to staging
```

---

## Structured YAML Requirement Spec Format

Every feature begins with a requirement spec that AI can parse:

```yaml
# feature: cash-deposit.yaml
feature_id: CBS-TELLER-001
title: "Cash Deposit to CASA Account"
idrbt_reference: "Section 1.2.1 — Cash deposit at counter"
priority: P1
module: Teller
bounded_context: Account

business_rules:
  - id: BR001
    rule: "Deposit amount must be greater than zero"
    validation_type: input
  - id: BR002
    rule: "Account must be in ACTIVE status to accept deposits"
    validation_type: business
  - id: BR003
    rule: "Denominations (currency chest) must reconcile with deposit amount"
    validation_type: business
  - id: BR004
    rule: "Deposits above maker_checker_threshold require checker approval"
    validation_type: workflow
    parameter: workflow.maker_checker_threshold
  - id: BR005
    rule: "Maximum single cash deposit is ₹2 lakh (PMLA threshold)"
    validation_type: regulatory
    source: "PMLA 2002 Section 12"

api:
  method: POST
  path: /api/account/{accountId}/deposit
  auth: TELLER, OFFICER
  request:
    accountId: GUID
    amount: decimal (> 0, <= 200000)
    denominations:
      - denomination: integer
        count: integer
    narration: string (max 100 chars)
    branchId: GUID

  response:
    transactionId: GUID
    status: string  # POSTED | PENDING_CHECK
    newBalance: decimal
    receiptNumber: string

domain_events:
  - AccountCredited
  - MakerCheckerCreated (if amount > threshold)

gl_posting:
  debit: "Cash in Hand (1001)"
  credit: "Customer Account GL Head"

audit_requirements:
  - Log teller ID, amount, denominations, timestamp, IP
  - Log checker ID if maker-checker triggered
```

---

## AI Code Generation Prompts

### Generating C# Controller
```
PROMPT TEMPLATE:
Given the requirement spec [feature: cash-deposit.yaml], generate a C# ASP.NET Core 8
controller action that:
1. Validates the request using FluentValidation (rules BR001, BR002, BR005)
2. Checks maker-checker threshold from ParametrizationService
3. Creates a pending transaction if above threshold, otherwise posts immediately
4. Publishes AccountCredited domain event via MediatR
5. Returns the response DTO

Follow these patterns from the existing codebase:
- [AccountController.cs pattern]
- [MakerCheckerService.cs pattern]
Use the existing BaseController, TenantContext, and AuditService injection patterns.
```

### Generating xUnit Tests
```
PROMPT TEMPLATE:
Given the requirement spec [feature: cash-deposit.yaml], generate xUnit integration tests
covering:
1. Happy path: valid deposit posts successfully
2. Zero amount: returns 400 with validation error
3. Inactive account: returns 422 with business error
4. Above PMLA limit (>2L): returns 400
5. Above maker-checker threshold: returns 202 (pending)
6. Maker-checker: same person tries to check → returns 403

Use WebApplicationFactory<Program> for integration tests.
Seed test data using the TestDataBuilder pattern from existing tests.
```

---

## AI Expression Engine Integration

The ExpressionBuilderService (already built) enables AI-generated financial rules:

```yaml
# AI-generated expression example
expression:
  id: EXPR_PERSONAL_LOAN_ELIGIBILITY
  name: "Personal Loan Eligibility Check"
  input_parameters:
    - name: monthlyIncome
      type: decimal
    - name: existingEmi
      type: decimal
    - name: creditScore
      type: integer
    - name: employmentType
      type: string
  formula: |
    var dsr = existingEmi / monthlyIncome;
    var maxEmiNew = monthlyIncome * 0.5m - existingEmi;
    var eligible = creditScore >= 650
                && dsr <= 0.4m
                && maxEmiNew > 0
                && (employmentType == "SALARIED" || monthlyIncome >= 50000);
    return new { Eligible = eligible, MaxEmi = maxEmiNew, Dsr = dsr };
  test_cases:
    - input: { monthlyIncome: 50000, existingEmi: 5000, creditScore: 720, employmentType: "SALARIED" }
      expected: { Eligible: true, MaxEmi: 20000 }
    - input: { monthlyIncome: 30000, existingEmi: 20000, creditScore: 600, employmentType: "SELF_EMPLOYED" }
      expected: { Eligible: false }
```

The AI agent generates the expression, tests it against test cases, then commits to ExpressionBuilderService for runtime evaluation.

---

## AI-Assisted Code Review Rules

AI reviewers check for:
```
Security:
  ✓ No raw SQL (parameterized queries only)
  ✓ No secrets in code (passwords, API keys)
  ✓ Input validation present for all user inputs
  ✓ Authorization attribute on all controllers
  ✓ Audit log call present in financial methods

Architecture:
  ✓ Controllers do not contain business logic
  ✓ No cross-module DbContext access
  ✓ Domain events published for state changes
  ✓ Maker-checker check present for financial operations

Banking-Specific:
  ✓ Decimal used for all monetary calculations (not float/double)
  ✓ Amounts stored as NUMERIC(18,2) in PostgreSQL
  ✓ All GL postings balance (Dr = Cr)
  ✓ Effective date parameter lookup (not hardcoded rates)
```

---

## Documentation Repository Structure

```
saar-core-banking-services/
├── ARCHITECTURE/
│   ├── README.md                     (Master architecture overview)
│   ├── adr/                          (Architecture Decision Records)
│   └── components/                   (Component-level documentation)
├── specs/
│   ├── requirements/                 (YAML requirement specs per feature)
│   │   ├── teller/
│   │   │   ├── cash-deposit.yaml
│   │   │   ├── cash-withdrawal.yaml
│   │   │   └── cheque-deposit.yaml
│   │   ├── loans/
│   │   │   ├── personal-loan-origination.yaml
│   │   │   └── loan-emi-payment.yaml
│   │   └── ...
│   ├── expressions/                  (Expression library specs)
│   │   ├── eligibility/
│   │   └── interest/
│   └── openapi/                      (Generated OpenAPI specs)
├── orders/                           (AI agent instruction templates)
│   ├── new-feature.md
│   ├── add-expression.md
│   └── fix-bug.md
└── CLAUDE.md                         (AI agent persistent instructions)
```

---

## Consequences

### Positive
- Requirement specs are machine-readable → AI can generate code directly from them
- Structured format enforces completeness (business rules, GL impact, audit requirements documented)
- Test generation from specs ensures business rules are tested, not just code coverage
- AI review catches security/architecture anti-patterns before human review

### Negative / Mitigations
- **Risk:** AI-generated code contains subtle business logic errors (e.g., wrong NPA threshold)
  - **Mitigation:** All generated code reviewed by a banking domain expert before merge
- **Risk:** Requirement spec becomes out of date with actual implementation
  - **Mitigation:** Spec file checked in alongside the code it specifies (same PR)
- **Risk:** AI agents use wrong patterns from older code
  - **Mitigation:** CLAUDE.md instructions + explicit pattern files in `orders/` directory

---

## Related Decisions
- ADR-003: Technology Stack (Roslyn enables AI-generated expressions)
- All ADRs: Architecture documentation serves as context for AI code generation

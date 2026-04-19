# Framework Gap Backlog — Stub Tickets

> These are JIRA-equivalent stubs for framework gaps identified in session 34.
> Each will be expanded into a full requirement doc before development begins (per standing rule).
> Current priority order is set below.

---

## SAAR-DFS-001 — DynamicFieldsSchemaService: Real DB-backed Forms
**Priority:** High
**Status:** BACKLOG
**Blocked by:** Nothing — can start after SAAR-EXPR-001

### Problem
`DynamicFieldsSchemaService` (port 5013) currently returns a hardcoded JSON for a personal loan form.
It does NOT read from any database — the "service" is a stub with no real configuration capability.

### Why It Matters
- Bank admin cannot add a new field to a loan form without a code change + deployment
- Gold Loan form (purity, weight, vault location) will be hard-coded in React if this isn't fixed
- Every new product (Vehicle Loan, Education Loan) requires a React PR

### Scope (to be detailed in full requirement doc)
1. `FieldSchema` entity: formId, tenantId, version, sections[], fields[]
2. Field types: text, number, select, date, file-upload, currency, percentage
3. `visibleWhen` condition: JSON expression or expression ID for conditional visibility
4. Seed schemas for: Gold Loan, Personal Loan, Account Opening
5. React `DynamicForm` component that renders any schema from the API
6. Admin UI: CRUD for field schemas (drag-and-drop field editor — Phase 2)

### Key Acceptance Criteria (preview)
- Gold Loan origination form rendered from schema, not hard-coded React
- Adding a new field = one DB record, no frontend deploy
- Conditional fields work: `loanType == "GOLD_LOAN"` shows gold-specific fields

---

## SAAR-WF-001 — WorkflowOrchestrationService: Multi-Level Approval Routing
**Priority:** High
**Status:** BACKLOG
**Blocked by:** Nothing — independent of SAAR-EXPR-001

### Problem
WorkflowOrchestrationService currently has a single checker per workflow type.
UCBs require amount-band based escalation:
- < ₹5L → Branch Manager alone
- ₹5L–₹25L → Branch Manager + Zonal Officer
- > ₹25L → Zonal Officer + Regional Head / Board (UCB regulation)

### Why It Matters
- UCB pilots cannot use the platform for large loan sanctions without multi-level approval
- RBI Circular: UCBs with deposits > ₹100Cr need Board approval for exposures > 5% of capital

### Scope (to be detailed in full requirement doc)
1. `ApprovalLevel` entity: workflowType, amountMin, amountMax, requiredRoles[], sequence
2. `WorkflowInstance` gains `ApprovalChain`: ordered list of pending approvers
3. Parallel vs sequential approval modes
4. Auto-escalation on SLA breach (reassign to next level)
5. Frontend: multi-step approval timeline showing all levels

### Key Acceptance Criteria (preview)
- ₹30L Gold Loan goes to Branch Manager → then Regional Head (sequence enforced)
- Rejecting at level 1 terminates chain (no escalation needed)
- Each approver sees only their pending step

---

## SAAR-CFG-001 — Bank Configuration Service: Feature Toggles per Tenant
**Priority:** Medium
**Status:** BACKLOG
**Blocked by:** Nothing — independent

### Problem
There is no per-tenant configuration store for product features, regulatory limits, or rate bands.
Currently, enabling Gold Loan for UCB demo requires seeding `loan_products` manually.
There is no UI for bank admin to toggle products on/off.

### Why It Matters
- Onboarding a new bank today = developer runs SQL scripts
- NBFC vs UCB have different regulatory caps (single borrower exposure, priority sector %)
- Demo story: "Deploy a new bank in 15 minutes" — impossible without a config UI

### Scope (to be detailed in full requirement doc)
1. `BankConfiguration` entity per tenant:
   - Features: GoldLoanEnabled, EducationLoanEnabled, UPIEnabled, MobileAppEnabled
   - Limits: MaxExposurePerBorrower, CDRLimit, PriorityLoanMinPercent
   - RateBands: per product (min/max/base interest rate)
   - BankType: UCB / NBFC / SCB / RRB / SFB
2. Admin UI (Settings page): toggle features, edit limits, view rate bands
3. Feature flag checked at API layer (middleware or service-level guard)
4. Tenant onboarding: default config seeded from BankType template

### Key Acceptance Criteria (preview)
- Bank admin turns off `EducationLoanEnabled` → Education Loan tab disappears in React UI
- UCB has `MaxExposurePerBorrower = ₹1.5Cr`; expression engine can reference this config value
- New tenant provisioned with UCB template → all UCB defaults active immediately

---

## SAAR-EXPR-002 — Expression → Workflow Routing Integration
**Priority:** Medium
**Status:** BACKLOG
**Blocked by:** SAAR-EXPR-001 (expression evaluation pattern), SAAR-WF-001 (multi-level workflow)

### Problem
WorkflowOrchestrationService approval level routing is currently hard-coded:
- Loan Sanction always goes to BRANCH_MANAGER
- No way to dynamically decide approval level based on amount, customer risk, or bank config

### Why It Matters
- Banks want: "for gold loans, LTV > 70% requires an additional risk officer review"
- Currently this requires code change + deployment
- Expression + Workflow = full no-code approval matrix

### Scope (to be detailed in full requirement doc)
1. `ApprovalRequirement.Condition` field: stores expression ID
2. WorkflowOrchestrationService calls ExpressionBuilderService to evaluate condition
3. Expression result → determines if this approval level is required
4. Example: `EXPR_GOLD_LOAN_RISK_LEVEL` → "HIGH_RISK" → add Risk Officer step

### Key Acceptance Criteria (preview)
- LTV > 72% on a gold loan auto-adds a Risk Officer approval step
- Bank admin can write/change the LTV threshold in ExpressionBuilderService — no code change
- Non-triggered conditions are skipped (approval chain is dynamic, not static)

---

## SAAR-ADMIN-001 — Low-Code Admin UI for Expressions and Workflows
**Priority:** Low (Large effort — requires SAAR-EXPR-001, SAAR-WF-001, SAAR-CFG-001 first)
**Status:** BACKLOG

### Problem
Currently, to change a business rule (e.g., loan eligibility criteria), a bank admin must:
1. Call the ExpressionBuilderService REST API manually
2. Know C# expression syntax
3. Have developer access

### Why It Matters
- Platform's core value proposition: "bank admin configures rules, not developers"
- Investor demo: live rule change with no code — the killer demo moment

### Scope (to be detailed in full requirement doc)
1. Expression Builder UI (existing `SimpleExpressionBuilder.tsx` — extend it)
   - Visual condition builder (field + operator + value rows, AND/OR connectors)
   - Test panel: enter sample inputs, see expression result
   - Version history: diff between expression versions
2. Workflow Designer UI
   - Add/remove approval levels per workflow type
   - Set amount bands and required roles
   - SLA configuration per level
3. Bank Configuration UI (extends SAAR-CFG-001 admin page)
4. Role: BANK_ADMIN or PARAM_ADMIN can access; all changes go through maker-checker

### Key Acceptance Criteria (preview)
- Bank admin changes Gold Loan LTV limit from 75% → 70% in 3 clicks
- Change requires checker (BANK_ADMIN) approval before going live
- Expression versioned: can rollback to previous version in 1 click

---

## Summary Backlog Table

| Ticket | Title | Priority | Effort | Depends On |
|--------|-------|----------|--------|-----------|
| SAAR-GL-001 | Gold Loan Phase 1 | **High** | Medium | Nothing (approved) |
| SAAR-EXPR-001 | Expression Engine → AccountService + TransactionService | **High** | Small | Nothing |
| SAAR-DFS-001 | DynamicFieldsSchema — real DB forms | High | Medium | Nothing |
| SAAR-WF-001 | Workflow multi-level approval routing | High | Medium | Nothing |
| SAAR-CFG-001 | Bank Configuration + feature toggles | Medium | Medium | Nothing |
| SAAR-EXPR-002 | Expression → Workflow routing | Medium | Small | SAAR-EXPR-001, SAAR-WF-001 |
| SAAR-ADMIN-001 | Low-Code Admin UI | Low | Large | All above |

**Recommended sprint order:**
1. SAAR-GL-001 (Gold Loan Phase 1) + SAAR-EXPR-001 in parallel (both approved, independent)
2. SAAR-DFS-001 + SAAR-WF-001 (both medium effort, both unblock SAAR-ADMIN-001)
3. SAAR-CFG-001 + SAAR-EXPR-002
4. SAAR-ADMIN-001 (final — depends on all above)

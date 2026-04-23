# Multi-Level Approval Routing — Requirements & Implementation Instructions

**Ticket ID:** SAAR-WF-001
**Created:** 2026-04-22
**Status:** IN PROGRESS
**Priority:** High
**Reporter:** Product Owner
**Assignee:** Engineering
**Sprint:** Session 40

---

## 1. Business Context

Urban Co-operative Banks (UCBs) must comply with RBI circulars mandating tiered approval for loan sanction based on exposure amount. A single-checker approval is insufficient when:
- Loan amount > ₹5 lakh requires Credit Committee sign-off (not just Branch Manager)
- Loan amount > ₹25 lakh requires Board / Regional Head approval (RBI Master Circular on Advances, Para 6.3)
- UCBs with deposits > ₹100 Cr require Board approval for any single borrower exposure exceeding 5% of capital

**Current state:** `LoanApplicationsController` has a hard-coded 3-step state machine (SEND_TO_REVIEW → CREDIT_APPROVE → SANCTION) that does not vary by loan amount and does not persist who approved at each level.

**Business value:** Enables UCBs to configure amount-band escalation rules, satisfies RBI audit requirements, and provides a clear audit trail of who sanctioned what amount at which level.

---

## 2. Functional Requirements

### FR-WF-001: Amount-Band Lookup
**Priority:** P0

The system must determine the required approval levels based on the loan amount:

| Amount Band | Levels Required |
|---|---|
| < ₹5,00,000 | 1 level (Branch Manager) |
| ₹5,00,000 – ₹25,00,000 | 2 levels (Branch Manager + Credit Committee) |
| > ₹25,00,000 | 3 levels (Branch Manager + Credit Committee + Board Approval) |

**Acceptance Criteria:**
- [ ] A ₹4L loan creates 1 chain step (Branch Manager)
- [ ] A ₹10L loan creates 2 chain steps (Branch Manager, Credit Committee)
- [ ] A ₹30L loan creates 3 chain steps (Branch Manager, Credit Committee, Board Approval)
- [ ] Amount bands are seeded at startup; seed is idempotent

---

### FR-WF-002: Chain Initialisation on Review
**Priority:** P0

When a loan application moves to IN_REVIEW (SEND_TO_REVIEW action), the approval chain is initialised:
- `ApprovalChainSteps` are created for the loan in the WorkflowOrchestrationService
- All steps start with Status = PENDING
- Chain init is fire-and-forget (non-fatal if WorkflowOrchestrationService is unreachable)

**Acceptance Criteria:**
- [ ] After SEND_TO_REVIEW, `GET /api/approval/chain?entityId={appNo}&entityType=LOAN` returns the correct number of PENDING steps
- [ ] If WorkflowOrchestrationService is offline, loan still transitions to IN_REVIEW (fail-open)

---

### FR-WF-003: Sequential Enforcement
**Priority:** P0

Approval levels must be completed in sequence:
- Level 2 (Credit Committee) action is blocked until Level 1 (Branch Manager) is APPROVED
- SANCTION action in LoanApplicationsController checks that all required chain steps before the final level are APPROVED

**Acceptance Criteria:**
- [ ] Calling SANCTION when Level 1 is still PENDING returns `400 Bad Request` with message "Previous approval level must be completed first"
- [ ] SANCTION is allowed immediately for a ₹4L loan (only 1 level, already approved via CREDIT_APPROVE)

---

### FR-WF-004: Rejection Terminates Chain
**Priority:** P0

When a REJECT action is taken on the loan:
- The current pending chain step is marked REJECTED
- All subsequent PENDING steps are marked SKIPPED

**Acceptance Criteria:**
- [ ] After REJECT action, `GET /api/approval/chain` shows: rejected step = REJECTED, remaining steps = SKIPPED
- [ ] Loan status transitions to REJECTED in LoanApplicationsController

---

### FR-WF-005: Chain Visible in LoanDetail
**Priority:** P1

The frontend LoanDetail page shows the approval chain steps with their current statuses.

**Acceptance Criteria:**
- [ ] LoanDetail.tsx shows an "Approval Chain" box with step labels, roles, status chips
- [ ] PENDING = amber chip, APPROVED = green chip, REJECTED = red chip, SKIPPED = grey chip
- [ ] If chain is not initialised (e.g., old loans), section is not rendered
- [ ] If WorkflowOrchestrationService is unreachable, section is silently hidden (no error shown)

---

### FR-WF-006: Persisted per Tenant
**Priority:** P0

`ApprovalLevel` and `ApprovalChainStep` data is stored in the correct tenant schema (WorkflowOrchestrationService multi-tenancy).

**Acceptance Criteria:**
- [ ] UCB tenant approval chain steps are isolated from NBFC tenant
- [ ] Schema is provisioned on service startup via `TenantSchemaProvisioner`

---

## 3. Non-Functional Requirements

| Attribute | Requirement |
|---|---|
| Resilience | All calls from LoanService to WorkflowOrchestrationService are fail-open (non-fatal) |
| Performance | Chain init + action endpoints respond in < 200ms p95 |
| Multi-tenancy | Data isolated per tenant schema (existing WorkflowOrchestrationService pattern) |
| Auditability | Each chain step records `performedBy`, `comments`, `actionedAt` |
| Backwards compat | Existing loans with no chain steps are handled gracefully (no crash) |

---

## 4. Out of Scope (Phase 1)

- Parallel (concurrent) approvals at the same level
- Admin UI to configure approval levels (Phase 2)
- Role enforcement — any logged-in user can perform any action (Phase 2)
- SLA escalation / timeout notifications (Phase 2)
- Gold Loan-specific approval chain (reuses LOAN_ORIGINATION config)

---

## 5. Architectural Decision

**ADR-014:** Approval chain data lives in WorkflowOrchestrationService.
See: `ARCHITECTURE/adr/ADR-014-approval-routing.md`

---

## 6. Data Model Summary

| Entity | Service | Key Fields |
|---|---|---|
| `ApprovalLevel` | WorkflowOrchestrationService | WorkflowType, AmountMin, AmountMax, Sequence, Label, RequiredRole, TimeoutHours |
| `ApprovalChainStep` | WorkflowOrchestrationService | EntityId (appNo), EntityType, Sequence, Label, RequiredRole, Status, PerformedBy, Comments, ActionedAt |

---

## 7. API Surface Summary

### WorkflowOrchestrationService — new `ApprovalController`
| Method | Route | Description |
|---|---|---|
| GET | `/api/approval/levels?workflowType=LOAN_ORIGINATION` | List configured approval levels |
| POST | `/api/approval/chain/init` | Create chain steps for an entity |
| GET | `/api/approval/chain?entityId={}&entityType=LOAN` | Get chain steps for an entity |
| POST | `/api/approval/chain/steps/{stepId}/action` | Submit APPROVE or REJECT at a step |

### LoanService — updated `LoanApplicationsController`
| Action | Change |
|---|---|
| SEND_TO_REVIEW | Fire-and-forget `InitApprovalChainAsync` |
| CREDIT_APPROVE | Fire-and-forget `SubmitChainStepActionAsync(APPROVE)` at level 1 |
| SANCTION | Check chain (GetApprovalChainAsync) then fire-and-forget `SubmitChainStepActionAsync(APPROVE)` at final level |
| REJECT | Fire-and-forget `SubmitChainStepActionAsync(REJECT)` |

---

## 8. Implementation Phases

### Phase 1 (this sprint) — Sequential Only
- [x] Requirement doc
- [ ] ADR-014
- [ ] `ApprovalLevel` + `ApprovalChainStep` entities + EF migration
- [ ] `ApprovalLevelSeedService` (3 UCB bands seeded at startup)
- [ ] `ApprovalController` (4 endpoints)
- [ ] `IWorkflowClient` + `WorkflowClient` extended in LoanService (3 new methods)
- [ ] `LoanApplicationsController` wired
- [ ] `LoanDetail.tsx` approval chain section
- [ ] `WorkflowOrchestrationService.Tests` (4 NUnit tests)
- [ ] `11-approval-routing.cy.ts` (15 Cypress tests)

### Phase 2 (future)
- Admin UI for approval level configuration (`/admin/approval-levels`)
- Role enforcement on chain step actions
- SLA escalation / timeout alerts
- Parallel approval support

---

## 9. Test Plan

### Unit Tests (WorkflowOrchestrationService.Tests)
| Test | Expected |
|---|---|
| `AmountBand_Under5L_Gets1Level` | amount 400000 → 1 ApprovalChainStep |
| `AmountBand_5L_to_25L_Gets2Levels` | amount 1000000 → 2 steps |
| `Sequential_BlocksLevel2_WhenLevel1Pending` | action on step 2 when step 1 PENDING → 400 |
| `Rejection_MarksRemainingSteps_Skipped` | REJECT at step 1 → steps 2,3 = SKIPPED |

### Cypress Regression (11-approval-routing.cy.ts)
- Loan detail approval chain section renders (3 describe blocks, 15 tests)
- Mocked chain responses for PENDING, APPROVED, REJECTED, empty states
- Status chip colours + step labels visible

### Manual Smoke
1. Create a ₹10L loan, submit, SEND_TO_REVIEW → confirm 2 chain steps in DB
2. CREDIT_APPROVE → confirm step 1 APPROVED
3. SANCTION → confirm step 2 APPROVED
4. Repeat with ₹30L loan → confirm 3 steps, that SANCTION is blocked until step 1+2 both APPROVED

---

## 10. Dependencies

| Dependency | Notes |
|---|---|
| WorkflowOrchestrationService running (port 5012) | LoanService calls it; fail-open if down |
| EF migration applied | `AddApprovalTables` migration must run before service starts |
| KnownTenants provisioned | `public`, `ucb_demo`, `nbfc_demo` — already seeded |

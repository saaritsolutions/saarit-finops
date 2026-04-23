# ADR-014: Multi-Level Approval Routing Architecture

**Date:** 2026-04-22
**Status:** Accepted
**Deciders:** Engineering Lead, Product Owner
**Ticket:** SAAR-WF-001

---

## Context

LoanApplicationsController has a hard-coded 3-step approval chain that does not vary by loan amount and provides no persistence of who approved at each level. RBI mandates tiered approval for UCBs — amount bands determine how many approval levels are required before disbursal.

Three architectural options were evaluated.

---

## Options Considered

### Option A: LoanService-local approval table
Add `ApprovalLevel` + `ApprovalChainStep` tables directly to `LoanServiceDb` (LoanDbContext).

**Pros:** Simple, one service, no network call.
**Cons:** Breaks domain boundaries (approval orchestration belongs in WorkflowOrchestrationService). Duplicates multi-tenancy infrastructure. All other services that need multi-level approval (Account Opening, Parameter Change) would need their own tables.

### Option B: WorkflowOrchestrationService (chosen)
Add `ApprovalLevel` + `ApprovalChainStep` tables to WorkflowOrchestrationService. LoanService calls it via HTTP (existing WorkflowClient pattern, fail-open).

**Pros:** Correct domain boundary. Reuses existing multi-tenancy infrastructure (TenantSchemaProvisioner, TenantResolutionMiddleware, TenantModelCacheKeyFactory). All services share the same approval routing engine. Config (ApprovalLevels) is tenant-configurable in one place.
**Cons:** Additional network hop; mitigated by fail-open (non-fatal calls).

### Option C: Expression-engine-only (no DB)
Store approval level config as expressions. Evaluate at runtime.

**Pros:** Fully dynamic, no migration.
**Cons:** No persistence of individual step status. Approval audit trail is lost on service restart. Complex to implement correctly.

---

## Decision

**Option B — WorkflowOrchestrationService**

This is the correct domain boundary. The WorkflowOrchestrationService is already the authority for workflow state, SLA tracking, and approval orchestration. Adding approval levels and chain steps here keeps the architecture consistent and allows all products (loans, accounts, parameter changes) to use the same routing engine.

---

## Consequences

- WorkflowOrchestrationService gains 2 new EF entities (`ApprovalLevel`, `ApprovalChainStep`) and a new `ApprovalController`
- LoanService `IWorkflowClient` gains 3 new methods (`InitApprovalChainAsync`, `GetApprovalChainAsync`, `SubmitChainStepActionAsync`)
- All new WorkflowOrchestrationService calls from LoanService are **fail-open** — if the service is unreachable, the loan state machine continues
- EF migration `AddApprovalTables` must be applied before service restart on Hetzner
- Phase 2: Admin UI for configuring approval levels per bank; role enforcement on actions

---

## Data Model

```
ApprovalLevel (config — per tenant schema)
├── Id (int, PK)
├── WorkflowType: "LOAN_ORIGINATION"
├── AmountMin: decimal
├── AmountMax: decimal (MaxValue = unbounded)
├── Sequence: int (1, 2, 3)
├── Label: "Branch Manager"
├── RequiredRole: "CHECKER" | "MANAGER" | "BOARD"
└── TimeoutHours: int

ApprovalChainStep (instance — per loan application)
├── Id (Guid, PK)
├── EntityId: string (ApplicationNumber)
├── EntityType: string ("LOAN")
├── Sequence: int
├── Label: string
├── RequiredRole: string
├── Status: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED"
├── PerformedBy: string?
├── Comments: string?
├── CreatedAt: DateTime
└── ActionedAt: DateTime?
```

---

## Seeded Approval Levels (UCB Standard — workflowType = LOAN_ORIGINATION)

| Sequence | AmountMin | AmountMax | Label | Role |
|---|---|---|---|---|
| 1 | 0 | MaxValue | Branch Manager | CHECKER |
| 2 | 500,000 | MaxValue | Credit Committee | MANAGER |
| 3 | 2,500,000 | MaxValue | Board Approval | BOARD |

All 3 levels are always seeded; amount-band filtering at chain init time determines which are actually required.

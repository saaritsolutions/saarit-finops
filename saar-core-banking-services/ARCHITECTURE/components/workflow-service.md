# WorkflowOrchestrationService

## Purpose
Orchestrates all multi-step, stateful business processes: maker-checker approvals, loan sanction workflows, EOD/BOD pipeline execution, and standing instruction scheduling.

## Port
`:5012`

## Responsibilities
- Maker-Checker workflow for all financial transactions
- Loan origination approval chain (Maker → Officer → Branch Manager)
- Account opening approval workflow
- Parameter change approval workflow
- EOD/BOD batch job orchestration (step-by-step pipeline)
- Standing Instruction scheduling and execution
- Pending task queue for each user/role
- SLA monitoring (alert if task not acted upon within time limit)
- Workflow history and audit trail

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/workflow/pending` | Get pending items for current user |
| GET | `/api/workflow/{id}` | Get workflow instance details |
| POST | `/api/workflow/{id}/approve` | Approve (checker action) |
| POST | `/api/workflow/{id}/reject` | Reject with reason |
| POST | `/api/workflow/{id}/return` | Return to maker for amendment |
| GET | `/api/workflow/history` | Workflow history (audit) |
| GET | `/api/workflow/eod/status` | Current EOD status |
| POST | `/api/workflow/eod/start` | Trigger EOD (ADMIN role) |
| POST | `/api/workflow/eod/resume` | Resume failed EOD |
| GET | `/api/workflow/eod/steps` | EOD pipeline step results |
| GET | `/api/DynamicForm/{id}` | Get workflow form schema |

## Workflow Types
| Workflow | Maker | Checker | SLA |
|---|---|---|---|
| Cash Deposit > threshold | TELLER | OFFICER | 4 hours |
| Account Opening | TELLER | OFFICER | 4 hours |
| Loan Sanction | OFFICER | BRANCH_MANAGER | 48 hours |
| Loan Disbursement | OFFICER | BRANCH_MANAGER | 24 hours |
| RTGS > ₹2L | OFFICER | BRANCH_MANAGER | 2 hours |
| Parameter Change | PARAM_ADMIN | BANK_ADMIN | 24 hours |
| Account Closure | TELLER | OFFICER | 4 hours |

## Maker-Checker State Machine
```
DRAFT
  ↓ Submit (Maker)
PENDING_REVIEW
  ↓ Approve (Checker)        ↓ Reject (Checker)     ↓ Return (Checker)
APPROVED                   REJECTED                 RETURNED_TO_MAKER
  ↓ Post (System)                                     ↓ Amend (Maker)
COMPLETED                                           PENDING_REVIEW (again)
```

## SLA Chip Status (WorkflowTimeline UI)
```
GREEN:  < 50% of SLA time elapsed
AMBER:  50–90% of SLA time elapsed
RED:    > 90% of SLA time elapsed or overdue
GREY:   Workflow completed (approved/rejected)
```

## Data Model
```
WorkflowInstance
├── InstanceId (GUID)
├── WorkflowType: MAKER_CHECKER | LOAN_SANCTION | EOD_PIPELINE
├── ReferenceType: TRANSACTION | LOAN_APPLICATION | PARAMETER_CHANGE
├── ReferenceId
├── Status: PENDING | APPROVED | REJECTED | COMPLETED | EXPIRED
├── CreatedBy (Maker), CreatedAt
├── AssignedTo (role or specific user)
├── DueBefore (SLA deadline)
├── CheckedBy, CheckedAt, CheckerComment
└── Steps: [ { stepName, actor, action, timestamp, comment } ]
```

## EOD Integration
```
WorkflowService orchestrates EOD:
  1. Validates prerequisites (branch balancing, no stuck maker-checker items)
  2. Sets system to MAINTENANCE_MODE
  3. Executes each EOD step via EOD engine
  4. Publishes EodStepCompleted events
  5. Sets system back to ONLINE_MODE after BOD
```

## IDRBT Requirements Met
- Section 15: Maker-Checker (IDRBT mandatory for all financial transactions)
- Section 10: Standing Instructions
- Section 11: EOD batch processing
- IDRBT Annexure II: Dual control, transaction authorization

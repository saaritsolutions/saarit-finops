# Workflow Orchestration Service - Responsibilities

This service manages dynamic workflows, process definitions, approvals, and routing for all business processes (e.g., account opening, loan origination, KYC, etc.).

## Key Responsibilities
- Define, store, and manage workflow/process templates (BPMN or custom format)
- Expose APIs to start, progress, and monitor workflow instances
- Support multi-step, multi-role, and conditional routing (e.g., maker-checker, approvals)
- Integrate with Product, Rules, and Template services for process-driven operations
- Allow runtime modification and versioning of workflows
- Provide APIs for workflow status, history, and audit
- Support exception handling, escalations, and notifications
- Ensure all workflow changes and executions are auditable

---

_This file is the single source of truth for the Workflow Orchestration Service's scope and responsibilities._

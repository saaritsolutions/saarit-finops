# Account Service - Responsibilities

This service manages all operations related to bank accounts, including opening, maintenance, transactions, and closure, while delegating product, rule, workflow, and template logic to the respective engines.

## Key Responsibilities
- Handle account opening, maintenance, status changes, and closure
- Process account transactions (debit, credit, transfers) as per configured rules and workflows
- Integrate with Product Configuration Service for product selection, eligibility, and parameterization
- Integrate with Workflow Orchestration Service for account lifecycle and approval processes
- Integrate with Business Rules Engine Service for validations, limits, and compliance checks
- Integrate with Template Management Service for document and notification generation
- Maintain account state, balances, and transaction history
- Ensure all account operations are auditable and versioned
- Expose APIs for account management and transaction processing

---

_This file is the single source of truth for the Account Service's scope and responsibilities._

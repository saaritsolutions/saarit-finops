# Product Configuration Service - Responsibilities

This service manages all product templates, metadata, and lifecycle configuration for banking products (accounts, loans, deposits, etc.).

## Key Responsibilities
- Define, store, and manage product templates and variants (e.g., SB, CA, FD, RD, Loan, etc.)
- Expose APIs to retrieve, create, update, and retire product definitions
- Support parameterization of product features, charges, limits, eligibility, and lifecycle states
- Provide APIs for eligibility checks and product selection logic
- Integrate with Workflow, Rules, and Template services for end-to-end product configuration
- Maintain product versioning and audit trails
- Support multi-language and multi-currency product definitions
- Ensure all product changes are auditable and traceable

---

_This file is the single source of truth for the Product Configuration Service's scope and responsibilities._

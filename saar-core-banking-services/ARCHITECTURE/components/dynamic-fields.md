# DynamicFieldsSchemaService

## Purpose
Stores and serves bank-specific form field schemas (per-product, per-tenant) enabling each bank
to configure their own loan application, account opening, and KYC forms without code changes.

## Port
`:5013`

## Implementation Status
- **Phase 1 (SAAR-DFS-001):** Database-backed storage, 6 form types, per-tenant overrides, validation endpoint. ✅ IN PROGRESS
- **Phase 2 (SAAR-DFS-002):** AccountService + CustomerService form integration, conditional field visibility, form designer UI.

## Responsibilities
- Store JSON schema definitions for each product/form type per tenant in PostgreSQL
- Serve form schemas to LoanService (DynamicFormsClient) and React frontend
- Support tenant-specific overrides with fallback to public default
- Validate submitted form data against stored schema
- Maintain version history and audit trail for all schema changes
- Seed production-quality default schemas for demo at startup

## Key API Endpoints (SAAR-DFS-001)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/forms/{formType}` | Public | Active schema for current tenant (with fallback to public default) |
| GET | `/api/forms` | ADMIN | List all schemas for current tenant |
| PUT | `/api/forms/{formType}` | ADMIN | Save/overwrite active schema; auto-increments version |
| POST | `/api/forms/{formType}/reset` | ADMIN | Reset to public default (removes tenant override) |
| GET | `/api/forms/{formType}/history` | ADMIN | Version history (latest first) |
| POST | `/api/forms/validate` | Public | Validate form submission payload against schema |

## Form Types
| FormType Constant | Description | Consumer |
|---|---|---|
| `PERSONAL_LOAN` | Personal loan application (12 fields) | LoanService, React LoanOrigination |
| `HOME_LOAN` | Home loan with co-applicant + property details | LoanService |
| `GOLD_LOAN` | Gold loan with pledge item entry (10 fields) | LoanService Gold module |
| `ACCOUNT_OPENING_SB` | Savings Bank account opening (10 fields) | AccountService (Phase 2) |
| `ACCOUNT_OPENING_FD` | Fixed Deposit opening (8 fields) | AccountService (Phase 2) |
| `KYC_INDIVIDUAL` | Individual KYC verification (8 fields) | CustomerService (Phase 2) |

## Data Model
```
FormSchema
├── Id (Guid, PK)
├── FormType (string, max 50, indexed)
├── TenantId (string, max 50, indexed) — "public" = default for all banks
├── Version (int) — increments on each PUT
├── SchemaJson (text) — JSON FormSchema (same shape as TypeScript FormSchema interface)
├── IsActive (bool) — only one active per (FormType, TenantId)
├── IsDefault (bool) — true = seed record; admin edits clone from this
├── CreatedBy (string)
├── CreatedAt, UpdatedAt (DateTime UTC)
└── Notes (string, nullable) — admin change note

FormSchemaHistory (append-only audit trail)
├── Id (Guid, PK)
├── FormSchemaId (FK → FormSchema.Id)
├── Version (int)
├── SchemaJson (text)
├── SavedBy (string)
├── SavedAt (DateTime UTC)
└── Notes (string, nullable)
```

## Schema Lookup Order
```
GET /api/forms/{formType} (tenant header = "ucb_demo")
  1. Find IsActive=true WHERE FormType={formType} AND TenantId="ucb_demo"  → if found: return
  2. Find IsActive=true WHERE FormType={formType} AND TenantId="public"    → if found: return
  3. 404 Not Found
```

## Schema JSON Format
```json
{
  "title": "Personal Loan Application",
  "sections": [
    { "key": "applicant", "title": "Applicant Details", "fields": ["fullName", "dateOfBirth", "panNumber"] },
    { "key": "employment", "title": "Employment & Income", "fields": ["employmentType", "monthlyIncome"] },
    { "key": "loan", "title": "Loan Details", "fields": ["loanAmount", "tenureMonths"] }
  ],
  "fields": [
    {
      "name": "fullName",
      "label": "Full Name",
      "type": "text",
      "required": true,
      "maxLength": 100,
      "section": "applicant"
    },
    {
      "name": "employmentType",
      "label": "Employment Type",
      "type": "select",
      "required": true,
      "options": [
        { "value": "SALARIED", "label": "Salaried" },
        { "value": "SELF_EMPLOYED", "label": "Self Employed" }
      ],
      "section": "employment"
    }
  ]
}
```

## Per-Bank Customization Example
```
UCB_Demo overrides PERSONAL_LOAN schema:
  - "Monthly Income" label → "Monthly Net Salary (after deductions)"
  - Adds field: "cooperative_membership_years" (number, min=0)
  - Adds field: "guarantor_count" (select, options=[0,1,2])

Stored as FormSchema(FormType=PERSONAL_LOAN, TenantId=ucb_demo, IsDefault=false)
Public schema (TenantId=public) unchanged for all other tenants.
```

## Multi-Tenancy
- Same `TenantResolutionMiddleware` pattern as AccountService, LoanService, TransactionService
- JWT claim `tenant_id` → `X-Tenant-ID` header → schema lookup filter
- `TenantSchemaProvisioner.MigrateAsync()` runs per tenant on startup
- EF Core `HasDefaultSchema(tenantId)` + `SearchPath` routing

## IDRBT Requirements Met
- Section 5: Parametrization of products without source code modification
- IDRBT P1 Principle: parametrization over customization
- Each bank configures own forms per RBI branch licensing — no developer needed

## Validation Rules Supported
| Rule | Property | Applies To |
|---|---|---|
| Required | `required: true` | all types |
| Minimum value | `min: N` | number |
| Maximum value | `max: N` | number |
| Max string length | `maxLength: N` | text |
| Regex pattern | `validationRegex: "..."` | text |
| Options | `options: [...]` | select |

# Dynamic Forms Schema Service — Requirements & Implementation Instructions

**Ticket ID:** SAAR-DFS-001
**Created:** 2026-04-19
**Status:** APPROVED FOR DEVELOPMENT
**Priority:** High
**Reporter:** Product Owner
**Assignee:** Engineering
**Sprint:** Session 35

---

## 1. Business Context

The DynamicFieldsSchemaService was stubbed in session 2 as a single endpoint returning
7 hardcoded fields. For the past 30+ sessions the platform has used a workaround:
LoanService stores form schemas as static JSON files
(`LoanService/Static/loan_form_PERSONAL_LOAN.json`) and AdminConfigController
reads/writes them directly.

This workaround is inadequate for the product's core differentiator claim:
> **"Each bank can configure its own products and forms without writing code."**

With static files there is no per-bank customization, no versioning, no audit trail,
and no programmatic API — which means a bank admin cannot change a field label
without a developer editing files and redeploying.

**Goal:** Make DynamicFieldsSchemaService a real persistence-backed service that:
1. Stores form schemas in PostgreSQL (multi-tenant, per-bank)
2. Serves correct per-product, per-tenant schemas to the frontend
3. Allows bank admins to customize schemas via the existing Admin Config UI
4. Provides a validation endpoint for submitted form data
5. Seeds production-quality demo schemas for 5 form types

**Demo story:**
Bank manager opens Admin Config → edits "Monthly Income" label → hits Save →
opens a new loan application → sees "Monthly Salary" in the form. Zero code deployment.

---

## 2. Functional Requirements

### FR-DFS-001: Form Schema Storage (persistence)

**Current state:** Zero persistence — hardcoded objects in controller.
**Required state:** PostgreSQL storage with EF Core + multi-tenancy.

**Data model:**

```
FormSchema
├── Id (Guid, PK)
├── FormType (string, max 50) — PERSONAL_LOAN | HOME_LOAN | GOLD_LOAN |
│                               ACCOUNT_OPENING_SB | ACCOUNT_OPENING_FD | KYC_INDIVIDUAL | KYC_CORPORATE
├── TenantId (string, max 50) — tenant-scoped override; "public" = default for all banks
├── Version (int) — increments on each PUT; used for optimistic concurrency display
├── SchemaJson (text) — full JSON schema (FormSchema TS interface)
├── IsActive (bool) — only one active schema per (FormType, TenantId)
├── IsDefault (bool) — if true, this is the seed/baseline schema; admin edits clone it first
├── CreatedBy (string, max 100)
├── CreatedAt (DateTime UTC)
├── UpdatedAt (DateTime UTC)
└── Notes (string, max 500, nullable) — admin change note
```

**Schema lookup logic (fallback chain):**

```
GET /api/forms/{formType}
  1. Find IsActive=true WHERE FormType={formType} AND TenantId={currentTenant}
     → if found: return it
  2. Find IsActive=true WHERE FormType={formType} AND TenantId="public"
     → if found: return it (shared default)
  3. Return 404 (form type not configured)
```

**Acceptance Criteria:**
- [ ] `FormSchema` entity persists to PostgreSQL via EF Core
- [ ] Multi-tenant isolation: `TenantSchemaProvisioner` provisions schemas per tenant on startup
- [ ] GET returns tenant-specific schema if available, else falls back to "public" default
- [ ] EF migration `AddFormSchemas` created and schema qualifiers stripped
- [ ] Seeder runs on startup (idempotent) — only inserts if no existing rows

---

### FR-DFS-002: Form Type Enumeration

**Supported form types in Phase 1:**

| FormType | Description | Used By |
|---|---|---|
| `PERSONAL_LOAN` | Personal loan application fields | LoanService origination form |
| `HOME_LOAN` | Home loan with co-applicant, property details | LoanService origination form |
| `GOLD_LOAN` | Gold loan with pledge item entry | LoanService (Gold Loan module) |
| `ACCOUNT_OPENING_SB` | Savings Bank account opening | AccountService |
| `ACCOUNT_OPENING_FD` | Fixed Deposit opening | AccountService |
| `KYC_INDIVIDUAL` | Individual KYC verification form | CustomerService |

**Each seed schema must include:**
- At least 8 fields covering the key data points
- Field types: `text`, `number`, `date`, `select`, `boolean`
- At least one `select` field with options (e.g., employment type, scheme type)
- Section grouping: e.g., "Applicant Info", "Loan Details", "Documents"
- Validation rules: `required`, `min`, `max`, `maxLength`, `validationRegex`

---

### FR-DFS-003: CRUD API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/forms/{formType}` | Public | Get active schema for current tenant (with fallback) |
| GET | `/api/forms` | ADMIN | List all schemas for current tenant (including inactive) |
| PUT | `/api/forms/{formType}` | ADMIN | Save/overwrite active schema; auto-increments version; deactivates previous |
| POST | `/api/forms/{formType}/reset` | ADMIN | Resets to public default (deactivates tenant override) |
| GET | `/api/forms/{formType}/history` | ADMIN | List all versions (latest first, paginated) |
| POST | `/api/forms/validate` | Public | Validate a form submission payload against the active schema |

**GET /api/forms/{formType} response shape:**
```json
{
  "formType": "PERSONAL_LOAN",
  "version": 3,
  "tenantId": "ucb_demo",
  "isDefault": false,
  "updatedAt": "2026-04-19T10:00:00Z",
  "updatedBy": "admin@ucb-demo.com",
  "schema": { ... FormSchema JSON ... }
}
```

**PUT /api/forms/{formType} request body:**
```json
{
  "schema": { ... FormSchema JSON ... },
  "notes": "Changed Monthly Income label to Monthly Salary for UCB"
}
```

**POST /api/forms/validate request body:**
```json
{
  "formType": "PERSONAL_LOAN",
  "data": { "fullName": "Ramesh", "loanAmount": 500000, ... }
}
```

**POST /api/forms/validate response:**
```json
{
  "isValid": true,
  "errors": [],
  "warnings": []
}
```

**Acceptance Criteria:**
- [ ] GET /api/forms/{formType} returns 200 with schema or 404 if not found
- [ ] PUT saves schema and increments version; previous schema version retained in history
- [ ] POST /api/forms/validate returns validation errors per field (required, min/max, regex)
- [ ] All ADMIN endpoints require JWT Bearer token (existing auth middleware)

---

### FR-DFS-004: LoanService Integration Fix

**Current broken flow:**

```csharp
// LoanService/Services/DynamicFormsClient.cs
public async Task<List<DynamicField>> GetLoanFormSchemaAsync(string productType)
{
    var fields = await _http.GetFromJsonAsync<List<DynamicField>>("/api/Fields"); // ← ignores productType
    return fields ?? new();
}
```

**Required fix:**

```csharp
public async Task<FormSchemaResponse?> GetFormSchemaAsync(string formType)
{
    return await _http.GetFromJsonAsync<FormSchemaResponse>(
        $"/api/forms/{Uri.EscapeDataString(formType)}");
}
```

**Changes required:**
- `DynamicFormsClient.GetFormSchemaAsync(string formType)` — updated URL + typed response
- `AdminConfigController.GetFormSchema` / `SaveFormSchema` — proxy to DynamicFieldsSchemaService instead of static files
- `FeatureFlags:EnableDynamicForms = true` in `LoanService/appsettings.Development.json`
- Remove `LoanService/Static/*.json` files (replaced by seeded DB records)

**Acceptance Criteria:**
- [ ] `GET /api/admin/config/forms/PERSONAL_LOAN` returns schema from DynamicFieldsSchemaService (not static file)
- [ ] `POST /api/admin/config/forms/PERSONAL_LOAN` saves schema to DynamicFieldsSchemaService
- [ ] Loan origination form schema loaded dynamically by formType
- [ ] Feature flag `EnableDynamicForms=true` in Development — falls back to hardcoded 7 fields if service down

---

### FR-DFS-005: Seed Schemas (demo-ready)

Five production-quality seed schemas (stored as `TenantId="public"`, `IsDefault=true`):

#### PERSONAL_LOAN (12 fields, 3 sections)
```
Section: Applicant
  - fullName (text, required, maxLength=100)
  - dateOfBirth (date, required)
  - mobileNumber (text, required, validationRegex=^[6-9]\d{9}$)
  - panNumber (text, required, validationRegex=^[A-Z]{5}[0-9]{4}[A-Z]$)
Section: Employment & Income
  - employmentType (select, required, options=[SALARIED, SELF_EMPLOYED, BUSINESS])
  - employerName (text, required, maxLength=100)
  - monthlyIncome (number, required, min=10000)
  - workExperienceYears (number, required, min=0, max=50)
Section: Loan Details
  - loanAmount (number, required, min=50000, max=5000000)
  - tenureMonths (number, required, min=12, max=60)
  - purposeOfLoan (select, required, options=[HOME_RENOVATION, EDUCATION, MEDICAL, WEDDING, OTHER])
  - existingLoanEMI (number, min=0, description="Total monthly EMI of existing loans")
```

#### GOLD_LOAN (10 fields, 3 sections)
```
Section: Applicant
  - fullName (text, required, maxLength=100)
  - mobileNumber (text, required)
  - panNumber (text, required)
Section: Loan Details
  - loanScheme (select, required, options=[BULLET, EMI, INTEREST_ONLY, OVERDRAFT])
  - loanAmount (number, required, min=5000, max=5000000)
  - tenureMonths (number, required, min=1, max=12)
  - purposeOfLoan (select, options=[AGRICULTURE, BUSINESS, PERSONAL, EDUCATION, MEDICAL])
Section: Pledge Details
  - goldPurity (select, required, options=[24K, 22K, 18K, 14K])
  - estimatedWeight (number, required, min=1, description="Estimated weight in grams")
  - numberOfItems (number, required, min=1, max=50, description="Number of gold ornaments/coins")
```

#### ACCOUNT_OPENING_SB (10 fields, 3 sections)
```
Section: Customer Details
  - fullName (text, required, maxLength=100)
  - dateOfBirth (date, required)
  - mobileNumber (text, required)
  - aadhaarNumber (text, validationRegex=^\d{12}$, description="12-digit Aadhaar number")
Section: Account Details
  - accountCategory (select, required, options=[REGULAR, BSBD, SENIOR_CITIZEN, MINOR, NRI])
  - modeOfOperation (select, required, options=[SINGLE, JOINTLY, EITHER_OR_SURVIVOR, ANYONE_OR_SURVIVOR])
  - nomineeRelationship (select, options=[SPOUSE, CHILD, PARENT, SIBLING, OTHER])
Section: KYC
  - panNumber (text, required)
  - kycType (select, required, options=[AADHAAR_EKYC, IN_PERSON_VERIFICATION, SIMPLIFIED_KYC])
  - annualIncome (number, required, min=0)
```

#### KYC_INDIVIDUAL (8 fields, 2 sections)
```
Section: Identity
  - fullName (text, required, maxLength=100)
  - dateOfBirth (date, required)
  - panNumber (text, required)
  - aadhaarNumber (text, required)
Section: Address
  - addressLine1 (text, required, maxLength=200)
  - city (text, required, maxLength=50)
  - state (select, required, options=[MH, GJ, KA, TN, RJ, UP, DL, WB, ...all 28 states + 8 UTs])
  - pincode (text, required, validationRegex=^\d{6}$)
```

#### ACCOUNT_OPENING_FD (8 fields, 2 sections)
```
Section: Deposit Details
  - depositAmount (number, required, min=10000)
  - tenureMonths (number, required, min=1, max=120)
  - interestPayoutMode (select, required, options=[CUMULATIVE, MONTHLY, QUARTERLY, HALF_YEARLY, ANNUALLY])
  - autoRenewal (boolean, description="Auto-renew at maturity?")
Section: Applicant
  - fullName (text, required)
  - mobileNumber (text, required)
  - panNumber (text, required)
  - nomineeRelationship (select, options=[SPOUSE, CHILD, PARENT, SIBLING, OTHER])
```

**Acceptance Criteria:**
- [ ] All 5 schemas seeded on DynamicFieldsSchemaService startup (idempotent)
- [ ] Each schema retrievable via `GET /api/forms/{formType}` from "public" tenant
- [ ] SchemaForm.tsx renders any of the 5 schemas correctly without code changes

---

### FR-DFS-006: Schema Validation Rules

The validation endpoint (`POST /api/forms/validate`) must implement:

| Rule | Field Property | Error Format |
|---|---|---|
| Required field missing | `required: true` | `"{fieldName} is required"` |
| Below minimum value | `min: N` | `"{fieldName} must be at least N"` |
| Above maximum value | `max: N` | `"{fieldName} must be at most N"` |
| Exceeds max length | `maxLength: N` | `"{fieldName} must not exceed N characters"` |
| Regex mismatch | `validationRegex: "..."` | `"{fieldName} format is invalid"` |
| Unknown field | (any key not in schema) | warning (not error): `"Unknown field: {fieldName}"` |

**Acceptance Criteria:**
- [ ] Validate returns `isValid: true` for complete valid data
- [ ] Returns field-level errors for each violation
- [ ] Unknown fields generate warnings not errors
- [ ] Numeric fields accept both string and number JSON types

---

## 3. Non-Functional Requirements

| NFR | Requirement |
|---|---|
| Multi-tenancy | TenantResolutionMiddleware + TenantSchemaProvisioner — same pattern as AccountService, LoanService |
| Fallback | If DynamicFieldsSchemaService is down: LoanService falls back to static schema (7 fields), logs warning |
| Performance | GET /api/forms/{formType} must respond in < 50ms (no joins — single row lookup by index) |
| Idempotent seeder | Startup seeder does NOT insert if schema already exists for (formType, tenantId="public") |
| Migration | EF migration `AddFormSchemas`; schema qualifiers stripped per multi-tenancy pattern |
| Schema size | SchemaJson column is `text` (unlimited) — schemas can have 50+ fields |
| Audit trail | Every PUT recorded in FormSchemaHistory (not deleted — append only) |

---

## 4. Out of Scope (Phase 2)

- **Conditional field visibility** (`visibleIf: { field: "X", equals: "Y" }`) — frontend rendering of conditions is Phase 2
- **AI form generation** from natural language (already exists in ExpressionBuilderService `/api/AIForm/generate`)
- **Drag-and-drop form designer UI** — Phase 2
- **Cross-field validation rules** (e.g., "loanAmount must be < 5× monthlyIncome") — Phase 3
- **AccountService form integration** (account opening form) — separate ticket SAAR-DFS-002
- **CustomerService KYC form integration** — separate ticket SAAR-DFS-002

---

## 5. Architectural Decision

**Decision:** Continue EF Core + PostgreSQL multi-tenant pattern. Schema stored as JSON text column
(not relational field definitions) — this is intentional for flexibility. Field-by-field
relational storage would require schema changes for every new field type.

**Pattern:**
```
FormSchema.SchemaJson = """
{
  "title": "Personal Loan Application",
  "sections": [
    { "key": "applicant", "title": "Applicant Details", "fields": ["fullName", "dateOfBirth"] }
  ],
  "fields": [
    { "name": "fullName", "label": "Full Name", "type": "text", "required": true, "maxLength": 100 }
  ]
}
"""
```

**ADR:** No new ADR required — consistent with existing EF Core multi-tenancy pattern (ADR-003).

---

## 6. Data Model Changes

### DynamicFieldsSchemaService
- **New:** `DbContext` + PostgreSQL connection (was in-memory / no DB)
- **New:** `FormSchema` entity (see FR-DFS-001)
- **New:** `FormSchemaHistory` entity (Id, FormSchemaId FK, Version, SchemaJson, SavedBy, SavedAt, Notes)
- **New:** EF migration `AddFormSchemas`
- **New:** `FormSchemaSeedService` (IHostedService — seeds 5 schemas on startup)
- **New:** `TenantResolutionMiddleware` + `TenantSchemaProvisioner` (standard pattern)
- **Update:** `FieldsController.cs` → rename to `FormsController.cs` with new routes

### LoanService
- **Update:** `DynamicFormsClient.cs` — fix URL to `/api/forms/{formType}` + new response DTO
- **Update:** `AdminConfigController.cs` — proxy to DynamicFieldsSchemaService
- **Update:** `appsettings.Development.json` — `FeatureFlags:EnableDynamicForms = true`
- **Remove:** `Static/loan_form_*.json` files

---

## 7. API Surface (New)

| Method | Endpoint | Service | Description |
|---|---|---|---|
| GET | `/api/forms/{formType}` | DynamicFieldsSchemaService | Get active schema for tenant |
| GET | `/api/forms` | DynamicFieldsSchemaService | List all schemas for tenant |
| PUT | `/api/forms/{formType}` | DynamicFieldsSchemaService | Save schema (create new version) |
| POST | `/api/forms/{formType}/reset` | DynamicFieldsSchemaService | Reset to public default |
| GET | `/api/forms/{formType}/history` | DynamicFieldsSchemaService | Get version history |
| POST | `/api/forms/validate` | DynamicFieldsSchemaService | Validate form submission |

---

## 8. Test Plan

### Unit Tests (DynamicFieldsSchemaService.Tests)
- [ ] `GetFormSchema_ReturnsTenantSchema_WhenTenantOverrideExists`
- [ ] `GetFormSchema_FallsBackToPublicDefault_WhenNoTenantOverride`
- [ ] `GetFormSchema_Returns404_WhenFormTypeUnknown`
- [ ] `SaveFormSchema_IncrementsVersion_WhenUpdated`
- [ ] `SaveFormSchema_DeactivatesPreviousVersion_OnUpdate`
- [ ] `ValidateForm_ReturnsValid_ForCompleteData`
- [ ] `ValidateForm_ReturnsRequiredFieldError_WhenMissing`
- [ ] `ValidateForm_ReturnsRangeError_WhenBelowMin`
- [ ] `ValidateForm_ReturnsRegexError_WhenPatternFails`

### Integration / Manual Test Flow
1. Start DynamicFieldsSchemaService (port 5013)
2. `GET http://localhost:5013/api/forms/PERSONAL_LOAN` → expect 200 with 12-field schema
3. `GET http://localhost:5013/api/forms/GOLD_LOAN` → expect 200 with 10-field schema
4. `PUT http://localhost:5013/api/forms/PERSONAL_LOAN` with UCB JWT → change "Monthly Income" label
5. `GET http://localhost:5013/api/forms/PERSONAL_LOAN` with UCB JWT → expect changed label
6. Open Admin Config UI → Personal Loan → verify changed label in JSON editor
7. `POST http://localhost:5013/api/forms/validate` with missing required field → expect error response
8. `GET http://localhost:5013/api/forms/PERSONAL_LOAN` with NBFC JWT → expect original label (tenant isolation)

---

## 9. Dependencies

| Dependency | Status |
|---|---|
| DynamicFieldsSchemaService | LIVE (port 5013) — empty stub |
| LoanService DynamicFormsClient | LIVE — wrong URL, broken |
| React SchemaForm.tsx | LIVE — renders any FormSchema correctly |
| React AdminConfig.tsx | LIVE — uses LoanService AdminConfigController |
| PostgreSQL | LIVE (multi-tenant) |
| TenantResolutionMiddleware pattern | LIVE in 5 other services — copy exact pattern |

---

## 10. Implementation Phases

### Phase 1 (This Ticket — SAAR-DFS-001)
1. DynamicFieldsSchemaService: DbContext + FormSchema + FormSchemaHistory + migrations
2. DynamicFieldsSchemaService: TenantResolutionMiddleware + TenantSchemaProvisioner
3. DynamicFieldsSchemaService: FormsController (GET/PUT/validate/reset/history)
4. DynamicFieldsSchemaService: FormSchemaSeedService (5 schemas)
5. LoanService: fix DynamicFormsClient URL + enable feature flag
6. LoanService: AdminConfigController proxy to DynamicFieldsSchemaService
7. Unit tests (9 tests)

### Phase 2 (SAAR-DFS-002 — future)
- AccountService account opening form integration
- CustomerService KYC form integration
- Conditional field visibility (`visibleIf`) evaluation
- Drag-and-drop form designer React component
- Form analytics (which fields users skip, error rates)

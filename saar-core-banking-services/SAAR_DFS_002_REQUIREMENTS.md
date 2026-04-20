# SAAR-DFS-002 — Form Builder UI

| Field | Value |
|---|---|
| **Ticket ID** | SAAR-DFS-002 |
| **Title** | React Form Builder — Visual Schema Editor for Bank Admins |
| **Status** | In Development |
| **Priority** | High |
| **Epic** | Dynamic Fields Schema (SAAR-DFS-*) |
| **Depends on** | SAAR-DFS-001 (DynamicFieldsSchemaService, LIVE) |
| **Owner** | Frontend |
| **Created** | 2026-04-21 |

---

## Background

SAAR-DFS-001 delivered a production-ready `DynamicFieldsSchemaService` with:
- 5 seed form schemas (PERSONAL_LOAN, GOLD_LOAN, ACCOUNT_OPENING_SB, ACCOUNT_OPENING_FD, KYC_UPDATE)
- Version history, tenant overrides, validation API
- REST endpoints on port 5013, proxied via nginx at `/api/forms`

**Problem:** A bank admin currently cannot change a form field label or add a help-text description without a code deployment. The low-code story for investors is incomplete without a UI.

---

## Functional Requirements

### FR-FB-001 — Schema List
The Form Builder landing tab shall display all form schemas for the logged-in tenant.
- Columns: Form Type | Tenant | Version | Active | Default | Updated By | Updated At | Actions
- Loads via `GET /api/forms` (requires Authorization)
- Shows both tenant-specific and public default schemas

**Acceptance Criteria:**
- AC-001-1: Table renders 5 rows (all seed schemas) for a freshly provisioned tenant
- AC-001-2: Each row has Edit, History, and Reset action buttons
- AC-001-3: Reset button is disabled / hidden when `isDefault=true` (already the public default)

### FR-FB-002 — Load Schema into Field Editor
Clicking Edit on a schema row loads its fields into Tab 1 (Field Editor).
- Calls `GET /api/forms/{formType}` to get the active schema
- Parses `response.schema` (JSON string) into an in-memory `FormSchemaJson` object
- Groups fields by `section` and displays each section in an MUI Accordion

**Acceptance Criteria:**
- AC-002-1: PERSONAL_LOAN loads 12 fields in 3 accordions (Applicant Details, Employment & Income, Loan Details)
- AC-002-2: Selecting a field card highlights it and populates the right-panel property editor
- AC-002-3: Loading a different form type from the dropdown replaces the editor state

### FR-FB-003 — Edit Field Properties
The right panel of the Field Editor allows editing properties of the selected field.

**Editable properties:**
| Property | Input | Condition |
|---|---|---|
| Label | TextField | always |
| Field Name | TextField (read-only) | always |
| Type | Select (text/number/date/select/textarea/boolean) | always |
| Required | Checkbox | always |
| Min | NumberField | type === 'number' only |
| Max | NumberField | type === 'number' only |
| Max Length | NumberField | type === 'text' or 'textarea' only |
| Validation Regex | TextField (monospace) | always |
| Description | TextField (multiline) | always |
| Options | Value+Label pair list with ＋/－ | type === 'select' only |

**Acceptance Criteria:**
- AC-003-1: Changing Label updates the field card in the left panel immediately
- AC-003-2: Switching type from 'number' to 'text' clears min/max and hides those inputs
- AC-003-3: Field Name input is visually disabled; no edit allowed
- AC-003-4: Selecting options for non-select types hides the Options editor

### FR-FB-004 — Add / Delete Fields
- "＋ Add Field" button at the footer of each section accordion appends a blank field to that section
- Each field card has a ✕ delete button that removes the field from the fields array and from `section.fields`

**Acceptance Criteria:**
- AC-004-1: New field has a generated name `field_<timestamp>`, label "New Field", type "text"
- AC-004-2: Deleted field no longer appears in the left panel or in Preview
- AC-004-3: Deleting a field while it is selected clears the right panel

### FR-FB-005 — Reorder Fields
Each field card has ▲ (move up) and ▼ (move down) buttons to reorder fields within a section.
- Movement swaps positions in the `schema.fields` array for fields in the same section
- ▲ is disabled on the first field of its section; ▼ is disabled on the last

**Acceptance Criteria:**
- AC-005-1: Clicking ▲ swaps the field with the one above it within the same section
- AC-005-2: ▲ on the top field of a section is disabled; ▼ on the bottom field is disabled
- AC-005-3: Preview reflects the new field order after reorder (no save required)

### FR-FB-006 — Save Schema
Save button submits the in-memory edited schema to the API.
- Calls `PUT /api/forms/{formType}` with `{ schema: JSON.stringify(editSchema), notes }`
- On success: shows a success chip "Saved v{N}"
- On error: shows error alert with API message

**Acceptance Criteria:**
- AC-006-1: Save creates a new version (version increments by 1)
- AC-006-2: Success chip shows the new version number
- AC-006-3: Saving with unchanged schema still creates a new version (no diff check needed)
- AC-006-4: Version Notes field is included in the save request

### FR-FB-007 — Version History
Tab 3 (History) shows the version history of a selected form type.
- Calls `GET /api/forms/{formType}/history`
- Columns: Version | Saved By | Saved At | Notes | (View JSON icon → Dialog)
- View JSON dialog shows the raw `schemaJson` string formatted with `JSON.stringify(parsed, null, 2)`

**Acceptance Criteria:**
- AC-007-1: After saving v2 in FR-FB-006, History shows 2 rows
- AC-007-2: Clicking the View JSON icon opens a Dialog with the schema JSON
- AC-007-3: History is empty for a schema that has never been edited (no prior versions archived)

### FR-FB-008 — Reset to Public Default
Reset button (in Schemas tab) removes the tenant's schema override.
- Calls `POST /api/forms/{formType}/reset` after a confirm dialog
- Success message from API is shown in a Snackbar/Alert

**Acceptance Criteria:**
- AC-008-1: Confirm dialog appears before sending the reset request
- AC-008-2: After reset, `GET /api/forms/{formType}` returns the public default schema
- AC-008-3: Reset is disabled/hidden for public-tenant schemas (already the default)

### FR-FB-009 — Live Preview
Tab 2 (Preview) renders the current in-editor schema using the existing `SchemaForm` component.
- Renders without requiring a save
- `readonly={true}` so no form submission is triggered

**Acceptance Criteria:**
- AC-009-1: Preview shows the form with updated field labels after an edit (before save)
- AC-009-2: A newly added field appears in Preview immediately
- AC-009-3: Deleted fields do not appear in Preview

---

## Non-Functional Requirements

| NFR | Requirement |
|---|---|
| NFR-1 Access Control | Route and sidebar entry gated by `BANKING_PERMISSIONS.SYSTEM_CONFIG` |
| NFR-2 Auth | All mutating API calls include `Authorization: Bearer <token>` header |
| NFR-3 Tenant | Tenant resolved server-side from JWT — no client-side tenant override |
| NFR-4 Performance | Schema list loads in < 1s for up to 50 schemas |
| NFR-5 Dependencies | No new npm packages — use existing MUI, React, fetch |
| NFR-6 No Backend Changes | Entirely frontend-side; no DynamicFieldsSchemaService code changes |

---

## Out of Scope (SAAR-DFS-003+)

- Drag-and-drop field reordering (use ▲/▼ for now)
- Section create / delete / reorder
- Form type create / delete
- Conditional field visibility (show field only if another field has a value)
- Field-level access control per user role
- Bulk import / export of schemas

---

## Files Changed

| File | Action |
|---|---|
| `saar-core-banking-services/SAAR_DFS_002_REQUIREMENTS.md` | This file |
| `frontend-react/src/services/dynamicFormsService.ts` | NEW |
| `frontend-react/src/pages/FormBuilder.tsx` | NEW |
| `frontend-react/src/router/AppRouter.tsx` | EDIT — add route |
| `frontend-react/src/components/layout/Sidebar.tsx` | EDIT — add nav entry |
| `saar-core-banking-services/nginx/nginx.conf` | EDIT — add `/api/forms` proxy |

---

## Test Plan

| Step | Action | Expected |
|---|---|---|
| 1 | Login as `admin@ucb-demo.com`, navigate to Administration → Form Builder | Page loads; 5 schemas in Schemas tab |
| 2 | Click Edit on PERSONAL_LOAN | Field Editor loads with 12 fields in 3 accordions |
| 3 | Click "Full Name" card | Right panel shows Label="Full Name", Type=text, Required=✓, MaxLength=100 |
| 4 | Change Label to "Full Name (as per Aadhaar)" | Left panel card updates immediately |
| 5 | Click ▲ on "Date of Birth" | Date of Birth moves above Full Name in its section |
| 6 | Fill Version Notes "Test save v2", click 💾 Save | Success chip shows "Saved v2" |
| 7 | Click Tab 2 (Preview) | Form renders with "Full Name (as per Aadhaar)" label |
| 8 | Click Tab 3 (History), select PERSONAL_LOAN | 2 rows: version 1 and version 2 |
| 9 | Click View JSON icon on v1 | Dialog shows original schema JSON |
| 10 | In Schemas tab, click Reset on PERSONAL_LOAN | Confirm dialog → success → schema reverts to v1 seed |
| 11 | `GET http://localhost:5013/api/forms/PERSONAL_LOAN` | Returns public default (isDefault=true) |
| 12 | Log in as `admin@nbfc-demo.com` and repeat steps 2–6 | nbfc_demo tenant gets its own v1 schema; ucb_demo unaffected |

# SAAR-DFS-004 — DFS Wired into Gold Loan Form + Custom Field Submission

**Ticket ID:** SAAR-DFS-004
**Status:** IN_PROGRESS
**Epic:** Dynamic Forms Service (DFS)
**Sprint:** 2026-04-23
**Depends on:** SAAR-DFS-003 (DFS wired into Personal Loan), SAAR-GL-001 (Gold Loan origination)
**Relates to:** SAAR-DFS-005 (conditional field visibility — future)

---

## Problem Statement

SAAR-DFS-003 wired the Dynamic Forms Service into the Personal Loan origination wizard additively — bank admins can add custom fields via Form Builder and they appear per wizard step without changing the hardcoded loan form. The Gold Loan wizard has the same need: UCB and NBFC admins want to capture gold-loan-specific custom data (e.g., borrower occupation, loan scheme preference, alternate ID) without code changes.

Additionally, SAAR-DFS-003 captured custom field values in React state only and never submitted them to the backend. This feature adds full round-trip persistence.

---

## Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-01 | DFS accordion appears in Gold Loan wizard Step 0 (Applicant Info) | Given DFS is online, when user reaches Step 0, a collapsible "Bank-Configured Fields" accordion appears with fields from `GOLD_LOAN` schema section `applicant` that are NOT in the exclusion set |
| FR-02 | DFS accordion appears in Gold Loan wizard Step 1 (Pledge Items) | Fields from section `pledge` not in exclusion set (e.g., `goldPurity`, `estimatedWeight`, `numberOfItems`) appear in accordion |
| FR-03 | DFS accordion appears in Gold Loan wizard Step 2 (Loan Details) | Fields from section `loan` not in exclusion set (e.g., `loanScheme`) appear in accordion |
| FR-04 | DFS offline is fail-silent | If DFS returns 4xx/5xx or is unreachable, accordion is not rendered; wizard continues without error |
| FR-05 | Exclusion set prevents duplicate fields | Fields `fullName`, `mobileNumber`, `panNumber`, `loanAmount`, `tenureMonths`, `purposeOfLoan` are never shown in accordion (already collected in hardcoded form) |
| FR-06 | Review step shows bank-configured field summary | Step 4 (Review & Submit) displays a "Bank-Configured Fields" card listing filled custom fields with label + value |
| FR-07 | Custom fields submitted to backend | `createGoldLoanApplication` call includes `customFieldsJson` (JSON-serialized custom field map). Empty object → field omitted |
| FR-08 | Backend stores custom fields in `FormDataJson` | `LoanApplication.FormDataJson` (existing column) is set to `customFieldsJson` value on POST `/api/gold-loan/applications` |
| FR-09 | GET detail returns `formDataJson` | `GET /api/gold-loan/applications/{id}` response includes `formDataJson` field |
| FR-10 | Detail page displays custom fields | `GoldLoanDetail.tsx` Loan Terms tab shows a "Bank-Configured Fields" section if `formDataJson` is present and non-empty |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | **Offline resilience**: DFS unavailability must not block or crash the Gold Loan wizard. All DFS calls must have `.catch(() => {})` handlers. |
| NFR-02 | **No EF migration**: `LoanApplication.FormDataJson` already exists. No new DB columns required. |
| NFR-03 | **No new npm dependencies**: Uses existing MUI Accordion, SchemaForm, dynamicFormsService. |
| NFR-04 | **Backward compatibility**: Existing Gold Loan applications with `FormDataJson = null` display no custom fields section — no crashes. |

---

## Out of Scope (SAAR-DFS-005)

- Conditional field visibility (show/hide field based on another field's value)
- Server-side validation of custom field values
- Custom field submission for Add Pledge Item endpoint

---

## Files Changed

| File | Change |
|------|--------|
| `LoanService/Controllers/Gold/GoldLoanController.cs` | Add `CustomFieldsJson?` to `CreateGoldLoanRequest`; store in `app.FormDataJson`; include in GET response |
| `frontend-react/src/services/goldLoanService.ts` | Add `customFieldsJson?` to `CreateGoldLoanRequest`; add `formDataJson?` to `GoldLoanDetail` |
| `frontend-react/src/pages/GoldLoanOrigination.tsx` | DFS schema loading, `BankConfiguredFields` component, accordion in Steps 0/1/2, review summary, submit with `customFieldsJson` |
| `frontend-react/src/pages/GoldLoanDetail.tsx` | Parse and display `formDataJson` in Loan Terms tab |
| `LoanService.Tests/GoldLoanTests.cs` | 1 new test: `CustomFieldsJson_IsStoredAndRoundTrips` |
| `frontend-react/cypress/e2e/regression/10-gold-loan.cy.ts` | 3 new tests: accordion renders, custom field in review, offline graceful |

---

## Test Plan

### Backend Unit Tests

| Test ID | Test Name | Description |
|---------|-----------|-------------|
| T-01 | `CustomFieldsJson_IsStoredAndRoundTrips` | POST with `CustomFieldsJson = '{"loanScheme":"EMI","goldPurity":"22K"}'`; GET detail; assert `FormDataJson` equals submitted JSON |

### Cypress Regression Tests

| Test ID | Description |
|---------|-------------|
| CY-01 | DFS accordion renders in Step 1 and Step 2 when DFS schema available |
| CY-02 | Custom field value persists to Review step summary card |
| CY-03 | DFS offline (503) → accordion NOT rendered; wizard loads normally |

---

## Section → Step Mapping (GOLD_LOAN DFS Schema)

| DFS section key | Wizard step | Non-hardcoded fields (shown) |
|---|---|---|
| `applicant` | Step 0 | — (all fields overlap with hardcoded exclusion set) |
| `pledge` | Step 1 | `goldPurity`, `estimatedWeight`, `numberOfItems` |
| `loan` | Step 2 | `loanScheme` |

**Exclusion set:** `fullName`, `mobileNumber`, `panNumber`, `loanAmount`, `tenureMonths`, `purposeOfLoan`

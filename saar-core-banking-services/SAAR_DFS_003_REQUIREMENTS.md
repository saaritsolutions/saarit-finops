# SAAR-DFS-003 — Wire DynamicFieldsSchemaService into Loan Origination (Additive)

| Field         | Value                                      |
|---------------|--------------------------------------------|
| Ticket ID     | SAAR-DFS-003                               |
| Status        | In Development                             |
| Priority      | High                                       |
| Epic          | Dynamic Forms / Low-Code Configuration     |
| Depends On    | SAAR-DFS-001 (DFS backend), SAAR-DFS-002 (Form Builder UI) |
| Date Created  | 2026-04-21                                 |
| Author        | saaritsolutions                            |

---

## Background

SAAR-DFS-001 built the `DynamicFieldsSchemaService` backend with 5 seed schemas, versioning, and
history. SAAR-DFS-002 delivered the Form Builder UI so bank admins can visually edit field schemas
without a code deployment.

However, `LoanOrigination.tsx` (the loan application wizard) is still 100% hardcoded static JSX.
An admin who adds a custom field via Form Builder sees no effect in the actual loan form.

This ticket completes the "low-code" demo story by wiring DFS into `LoanOrigination.tsx` using an
**additive** approach: the hardcoded form is untouched, and any DFS field that is _not_ already
hardcoded surfaces automatically as a "Bank-Configured Fields" accordion at the bottom of the
relevant wizard step.

---

## Functional Requirements

| ID         | Requirement                                                                                         | Acceptance Criteria |
|------------|-----------------------------------------------------------------------------------------------------|---------------------|
| FR-LO-001  | On component mount, fetch the `PERSONAL_LOAN` DFS schema via `dynamicFormsService.getSchema('PERSONAL_LOAN')` | Schema fetched once, not on every step transition |
| FR-LO-002  | Fields already in the hardcoded form are excluded via `HARDCODED_DFS_FIELDS` constant set           | Editing e.g. `fullName` label in Form Builder does NOT change hardcoded label |
| FR-LO-003  | DFS fields not in the exclusion set render as a collapsible "Bank-Configured Fields" accordion at the bottom of Steps 0, 1, and 2, mapped by DFS section key | accordion visible in relevant step when custom field exists |
| FR-LO-004  | Section → step mapping: `applicant_details`→Step 0, `employment_income`→Step 1, `loan_details`→Step 2 | Fields with unknown section keys are not displayed |
| FR-LO-005  | Custom field values are stored in `customFields: Record<string, any>` state separate from the hardcoded `form` state | Hardcoded field submission payload is unaffected |
| FR-LO-006  | On the Review step (Step 5), a "Bank-Configured Fields" summary card lists all custom field label+value pairs entered by the user | Card not rendered when no custom fields have values |
| FR-LO-007  | DFS fetch failure is silent — the accordion simply does not render; the hardcoded form works as before | No JS error thrown when DFS is offline |
| FR-LO-008  | `SchemaForm` component supports `textarea` field type (one-line fix) | No crash when DFS schema contains a textarea field |

---

## Non-Functional Requirements

- DFS fetch is a single `useEffect` with empty dependency array — fires once on mount only
- No new npm dependencies (SchemaForm and dynamicFormsService already exist)
- No backend changes to LoanService or DynamicFieldsSchemaService
- TypeScript: no `any` escape hatches except where `Record<string, any>` is the correct type (dynamic field bag)
- Build must succeed with zero TypeScript errors

---

## Out of Scope (SAAR-DFS-004+)

- Wiring DFS into GOLD_LOAN, ACCOUNT_OPENING_SB, ACCOUNT_OPENING_FD forms
- Submitting custom field values to the LoanService backend
- Conditional visibility (show field X only when field Y has value Z)
- Validation of custom fields on form submission
- Section create / delete via Form Builder

---

## Files Modified

| File                                                              | Change                                          |
|-------------------------------------------------------------------|-------------------------------------------------|
| `saar-core-banking-services/SAAR_DFS_003_REQUIREMENTS.md`        | NEW — this document                             |
| `frontend-react/src/components/forms/SchemaForm.tsx`              | Add `textarea` case to `renderField` switch     |
| `frontend-react/src/pages/LoanOrigination.tsx`                    | Add DFS fetch, `BankConfiguredFields` component, render in Steps 0/1/2, Review card |

---

## Test Plan

### Manual Smoke

1. Start DFS (`dotnet run --urls http://localhost:5013 ASPNETCORE_ENVIRONMENT=Development`)
2. Start React frontend (`PORT=3002 BROWSER=none npx craco start`)
3. Log in as `admin@ucb-demo.com` → Loans → New Application
4. Step 0 (Personal & KYC): verify no Bank-Configured accordion (all seed fields are hardcoded)
5. Open Form Builder → PERSONAL_LOAN → Edit → Add field: name=`referralCode`, label="Referral Code", type=text, section=`applicant_details` → Save
6. Reload New Application → Step 0 now shows "Bank-Configured Fields (1)" accordion containing "Referral Code" text input
7. Enter "REF123" → proceed through all steps to Review
8. Review step → "Bank-Configured Fields" card shows: `Referral Code: REF123`
9. Submit application → submission completes without error

### Offline / Resilience

10. Kill DFS process
11. Reload New Application — form loads, no Bank-Configured accordion, no JS console error

### Existing Tests

12. Cypress regression `09-form-builder.cy.ts` — all 22 tests still pass (Form Builder unchanged)
13. Cypress full regression suite — all 108 tests still pass

---

## Implementation Notes

### Exclusion Set
```typescript
const HARDCODED_DFS_FIELDS = new Set([
  'fullName', 'dateOfBirth', 'panNumber', 'aadhaarNumber', 'email', 'phoneNumber',
  'employmentType', 'monthlyIncome', 'employerName',
  'loanAmount', 'loanTenureMonths', 'loanPurpose',
]);
```

### Section → Step Mapping
```typescript
const DFS_SECTION_TO_STEP: Record<string, number> = {
  applicant_details: 0,
  employment_income: 1,
  loan_details: 2,
};
```

### BankConfiguredFields Component
Inline component inside `LoanOrigination` that:
1. Filters `dfsSchema.fields` by step + exclusion set
2. If none found, returns null (accordion not rendered)
3. Renders `<Accordion>` containing `<SchemaForm>` with the filtered fields
4. All values flow through `customFields` state

### SchemaForm textarea Fix
Add `case 'textarea': return <TextField multiline ... />;` between `case 'text':` and `default:`.

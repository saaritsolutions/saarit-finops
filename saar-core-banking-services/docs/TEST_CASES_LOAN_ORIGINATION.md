# Test Cases — Loan Origination Module
**Epic:** Loan Origination (SCRUM-164 to SCRUM-188)
**Last Updated:** 2026-04-06
**Format:** Given / When / Then (BDD)

---

## TC-01 · EMI Calculator API (SCRUM-171)

### TC-01-01 Standard EMI calculation
- **Given** the EMI endpoint is called with principal ₹5,00,000, tenure 36 months, rate 10.5% p.a.
- **When** `GET /api/loans/calculate-emi?principal=500000&tenureMonths=36&annualRatePercent=10.5`
- **Then** response HTTP 200; `MonthlyEMI` ≈ ₹16,246; `TotalPayment` = `MonthlyEMI × 36`; `TotalInterest` = `TotalPayment − 500000`; all values > 0

### TC-01-02 Long-tenure home loan
- **Given** principal ₹50,00,000, tenure 240 months, rate 8.5%
- **When** `GET /api/loans/calculate-emi?principal=5000000&tenureMonths=240&annualRatePercent=8.5`
- **Then** HTTP 200; `MonthlyEMI` ≈ ₹43,391; `TotalInterest` > `Principal` (interest-heavy)

### TC-01-03 Zero rate rejected
- **Given** `annualRatePercent=0`
- **When** any EMI calculation call
- **Then** HTTP 400 — "All parameters must be > 0"

### TC-01-04 Negative tenure rejected
- **Given** `tenureMonths=-1`
- **When** any EMI calculation call
- **Then** HTTP 400

### TC-01-05 Single month EMI
- **Given** principal ₹10,000, tenure 1 month, rate 12%
- **When** calculate EMI
- **Then** `MonthlyEMI` ≈ ₹10,100; `TotalInterest` ≈ ₹100

---

## TC-02 · FOIR Calculator API (SCRUM-172)

### TC-02-01 FOIR within limit
- **Given** monthly income ₹1,00,000, existing EMI ₹0, proposed EMI ₹40,000
- **When** `GET /api/loans/calculate-foir?monthlyIncome=100000&existingEMI=0&proposedEMI=40000`
- **Then** HTTP 200; `FOIRPercent = 40.00`; `IsWithinLimit = true`; `DisposableIncome = 60000`

### TC-02-02 FOIR exactly at 50% boundary
- **Given** income ₹1,00,000, existingEMI ₹20,000, proposed ₹30,000
- **When** calculate FOIR
- **Then** `FOIRPercent = 50.00`; `IsWithinLimit = true`

### TC-02-03 FOIR exceeds 50%
- **Given** income ₹1,00,000, existingEMI ₹30,000, proposed ₹25,000
- **When** calculate FOIR
- **Then** `FOIRPercent = 55.00`; `IsWithinLimit = false`

### TC-02-04 Zero income rejected
- **Given** `monthlyIncome=0`
- **When** calculate FOIR
- **Then** HTTP 400 — "monthlyIncome must be > 0"

### TC-02-05 DisposableIncome calculation
- **Given** income ₹80,000, existingEMI ₹10,000, proposed ₹20,000
- **When** calculate FOIR
- **Then** `DisposableIncome = 80000 − 10000 − 20000 = 50000`

---

## TC-03 · LTV Calculator API (SCRUM-173)

### TC-03-01 Home loan LTV within limit
- **Given** propertyValue ₹60,00,000, loanAmount ₹45,00,000, productType HOME_LOAN
- **When** `GET /api/loans/calculate-ltv?propertyValue=6000000&loanAmount=4500000&productType=HOME_LOAN`
- **Then** HTTP 200; `LTVPercent = 75.00`; `IsWithinLimit = true`; `LimitPercent = 80`

### TC-03-02 Home loan LTV exceeds 80%
- **Given** propertyValue ₹60,00,000, loanAmount ₹51,00,000
- **When** calculate LTV for HOME_LOAN
- **Then** `LTVPercent = 85.00`; `IsWithinLimit = false`

### TC-03-03 Gold loan LTV within 75% limit
- **Given** propertyValue ₹3,00,000, loanAmount ₹2,00,000, productType GOLD_LOAN
- **When** calculate LTV
- **Then** `LTVPercent ≈ 66.67`; `IsWithinLimit = true`; `LimitPercent = 75`

### TC-03-04 Gold loan LTV exceeds 75%
- **Given** propertyValue ₹2,00,000, loanAmount ₹1,80,000, productType GOLD_LOAN
- **When** calculate LTV
- **Then** `LTVPercent = 90.00`; `IsWithinLimit = false`

### TC-03-05 MaxLoanAmount calculation
- **Given** propertyValue ₹80,00,000, productType HOME_LOAN
- **When** calculate LTV
- **Then** `MaxLoanAmount = 64,00,000` (80,00,000 × 0.80, rounded to nearest ₹1,000)

---

## TC-04 · Full Eligibility Check (SCRUM-170)

### TC-04-01 Eligible applicant — happy path
- **Given** PERSONAL_LOAN product exists in DB; income ₹80,000, CIBIL 780, amount ₹4,00,000, tenure 36 months, existing EMI ₹5,000
- **When** `POST /api/loans/check-eligibility`
- **Then** HTTP 200; `IsEligible = true`; `RejectionReasons` empty; `RecommendedRatePercent = 11.00%` (750≤780<800 → base+0.50); `CibilBand = GOOD`

### TC-04-02 Rejected — FOIR exceeds 50%
- **Given** income ₹40,000, existing EMI ₹15,000, requested ₹5,00,000, tenure 36 months
- **When** check eligibility — proposed EMI ≈ ₹16,246 → FOIR ≈ 77%
- **Then** `IsEligible = false`; rejection reason includes "FOIR" and "50%"

### TC-04-03 Rejected — CIBIL below minimum
- **Given** PERSONAL_LOAN min CIBIL = 650; applicant CIBIL = 620
- **When** check eligibility
- **Then** `IsEligible = false`; rejection reason includes "CIBIL" and "620"

### TC-04-04 Rejected — amount below minimum
- **Given** PERSONAL_LOAN minimum ₹50,000; applicant requests ₹30,000
- **When** check eligibility
- **Then** `IsEligible = false`; rejection includes "minimum ₹50,000"

### TC-04-05 Rejected — amount exceeds maximum
- **Given** PERSONAL_LOAN maximum ₹40,00,000; applicant requests ₹50,00,000
- **When** check eligibility
- **Then** `IsEligible = false`; rejection includes "maximum"

### TC-04-06 Multiple rejections returned together
- **Given** CIBIL 600 (below min) AND FOIR 80% (exceeds limit)
- **When** check eligibility
- **Then** `RejectionReasons.Count >= 2`

### TC-04-07 CIBIL band assignment
- **Given** CIBIL scores: 820, 775, 715, 660, 600
- **When** check eligibility
- **Then** bands = EXCELLENT, GOOD, FAIR, MARGINAL, POOR respectively

### TC-04-08 Interest rate tiering by CIBIL
- **Given** PERSONAL_LOAN base rate 10.50%; CIBIL bands
- **When** check eligibility
- **Then** CIBIL ≥ 800 → 10.50%; ≥ 750 → 11.00%; ≥ 700 → 11.50%; ≥ 650 → 12.50%; < 650 → 18.00% (MaxRate)

---

## TC-05 · Loan Products API (SCRUM-169)

### TC-05-01 Get all products
- **Given** 5 products seeded on startup
- **When** `GET /api/loan-products`
- **Then** HTTP 200; array of 5 products; each has `productCode`, `name`, `minAmount`, `maxAmount`, `baseRatePercent`

### TC-05-02 Get product by code
- **When** `GET /api/loan-products/PERSONAL_LOAN`
- **Then** HTTP 200; `productCode = PERSONAL_LOAN`; `baseRatePercent = 10.50`; `minCibilScore` present

### TC-05-03 Unknown product code
- **When** `GET /api/loan-products/UNKNOWN_PRODUCT`
- **Then** HTTP 404

### TC-05-04 Get document checklist
- **When** `GET /api/loan-products/PERSONAL_LOAN/checklist`
- **Then** HTTP 200; array includes at least PAN card, income proof; each item has `documentType`, `isMandatory`, `acceptedFormats`

---

## TC-06 · Loan Application List API (SCRUM-174)

### TC-06-01 Returns paginated list
- **Given** 5 applications seeded per tenant
- **When** `GET /api/loans/applications`
- **Then** HTTP 200; `Total >= 5`; `Items.length <= 20`; `Page = 1`; `PageSize = 20`

### TC-06-02 Status filter
- **When** `GET /api/loans/applications?status=SUBMITTED`
- **Then** all returned items have `Status = SUBMITTED`; items with other statuses not included

### TC-06-03 Product type filter
- **When** `GET /api/loans/applications?productType=HOME_LOAN`
- **Then** all items have `ProductType = HOME_LOAN`

### TC-06-04 Search by applicant name (case-insensitive)
- **When** `GET /api/loans/applications?search=kumar`
- **Then** all returned items have applicant name containing "kumar" (case-insensitive)

### TC-06-05 Search by application number
- **When** `GET /api/loans/applications?search=LAP-UCB`
- **Then** returns matching applications

### TC-06-06 Pagination
- **When** `GET /api/loans/applications?page=2&pageSize=2`
- **Then** `Page = 2`; `Items.length <= 2`; different set from page 1

### TC-06-07 Empty result for no match
- **When** `GET /api/loans/applications?search=XYZNOTEXISTS`
- **Then** HTTP 200; `Total = 0`; `Items = []`

### TC-06-08 Pending approval queue
- **When** `GET /api/loans/applications/pending-approval`
- **Then** only statuses SUBMITTED, IN_REVIEW, CREDIT_APPROVED returned; DISBURSED and REJECTED excluded

---

## TC-07 · Application Detail API (SCRUM-175)

### TC-07-01 Full detail returned
- **Given** a seeded application with documents and actions
- **When** `GET /api/loans/applications/{valid-guid}`
- **Then** HTTP 200; response has `application`, `documents` (array), `actions` (array)

### TC-07-02 Documents ordered — mandatory first
- **When** get application detail
- **Then** mandatory documents appear before optional ones in `documents` array

### TC-07-03 Actions in chronological order
- **When** get application detail
- **Then** `actions` array sorted ascending by `actionAt`

### TC-07-04 Not found
- **When** `GET /api/loans/applications/00000000-0000-0000-0000-000000000099`
- **Then** HTTP 404

---

## TC-08 · Approval Workflow State Machine (SCRUM-178 / SCRUM-176)

### TC-08-01 SUBMITTED → IN_REVIEW (SEND_TO_REVIEW)
- **Given** application in SUBMITTED status
- **When** `POST /action` with `action = SEND_TO_REVIEW`
- **Then** status becomes IN_REVIEW; `actions` array has new entry with `fromStatus = SUBMITTED`, `toStatus = IN_REVIEW`

### TC-08-02 IN_REVIEW → CREDIT_APPROVED (CREDIT_APPROVE)
- **Given** application in IN_REVIEW status
- **When** action = CREDIT_APPROVE
- **Then** status = CREDIT_APPROVED; `ActionBy` and `Role` recorded in audit trail

### TC-08-03 CREDIT_APPROVED → APPROVED (SANCTION)
- **Given** application in CREDIT_APPROVED status
- **When** action = SANCTION with `sanctionedAmount = 480000`, `comments = "Sanctioned"`
- **Then** status = APPROVED; `SanctionedAmount = 480000`; `SanctionRemarks = "Sanctioned"`

### TC-08-04 APPROVED → DISBURSED (DISBURSE)
- **Given** application in APPROVED status
- **When** action = DISBURSE
- **Then** status = DISBURSED; `DisbursedAt` is not null

### TC-08-05 SUBMITTED → REJECTED
- **Given** application in SUBMITTED status
- **When** action = REJECT with comments = "CIBIL score insufficient"
- **Then** status = REJECTED; `RejectionReason = "CIBIL score insufficient"`

### TC-08-06 SUBMITTED → INFO_REQUESTED (REQUEST_INFO)
- **Given** application in SUBMITTED status
- **When** action = REQUEST_INFO with comments = "Please provide salary slips for last 6 months"
- **Then** status = INFO_REQUESTED

### TC-08-07 Invalid transition — CREDIT_APPROVE on non-SUBMITTED/IN_REVIEW
- **Given** application in DISBURSED status
- **When** action = CREDIT_APPROVE
- **Then** HTTP 400; error message includes "must be SUBMITTED or IN_REVIEW"

### TC-08-08 Invalid transition — DISBURSE on non-APPROVED
- **Given** application in CREDIT_APPROVED status
- **When** action = DISBURSE
- **Then** HTTP 400; error includes "must be APPROVED"

### TC-08-09 Invalid transition — SANCTION on non-CREDIT_APPROVED
- **Given** application in IN_REVIEW status
- **When** action = SANCTION
- **Then** HTTP 400; error includes "must be CREDIT_APPROVED"

### TC-08-10 Unknown action rejected
- **When** action = INVALID_ACTION
- **Then** HTTP 400; error includes "Unknown action"

### TC-08-11 Action on non-existent application
- **When** POST action on unknown GUID
- **Then** HTTP 404

### TC-08-12 Full lifecycle — DRAFT to DISBURSED
- **Given** application created in DRAFT status
- **When** transitions: SUBMIT → SEND_TO_REVIEW → CREDIT_APPROVE → SANCTION → DISBURSE
- **Then** final status = DISBURSED; `actions` has 5 entries; each with correct `fromStatus` → `toStatus`

---

## TC-09 · Frontend — Loan Management List (SCRUM-183)

### TC-09-01 List loads after login
- **Given** logged in as admin@ucb-demo.com
- **When** navigate to /loans
- **Then** page shows "Loan Applications" heading; at least 5 rows in the table

### TC-09-02 Status chip colours
- **Then** SUBMITTED → amber chip; DISBURSED → green chip; REJECTED → red chip; IN_REVIEW → blue chip

### TC-09-03 All Applications tab shows all
- **When** "All Applications" tab selected
- **Then** table shows all statuses

### TC-09-04 Pending Approval tab shows subset
- **When** "Pending Approval" tab selected
- **Then** only SUBMITTED, IN_REVIEW, CREDIT_APPROVED rows appear

### TC-09-05 Status filter dropdown
- **When** select "Submitted" from status filter
- **Then** table refreshes showing only SUBMITTED rows

### TC-09-06 Search filters results
- **When** type a known applicant name in the search box
- **Then** matching rows appear; non-matching rows disappear

### TC-09-07 View button navigates to detail
- **When** click the eye icon on any row
- **Then** URL changes to /loans/{guid}; loan detail page loads

### TC-09-08 New Application button
- **When** click "+ New Application"
- **Then** navigate to /loans/new; 6-step loan form appears

---

## TC-10 · Frontend — Loan Detail Page (SCRUM-184)

### TC-10-01 Detail page renders all sections
- **Given** navigate to /loans/{valid-id}
- **When** page loads
- **Then** sections visible: Applicant Details, Employment & Financials, Loan Parameters, Documents, Approval Timeline

### TC-10-02 KPI cards show loan data
- **Then** Requested Amount, Sanctioned Amount, Interest Rate, Tenure, CIBIL Score, FOIR all shown in summary bar

### TC-10-03 Repayment Schedule section visible
- **Given** loan has interestRate, requestedAmount, tenureMonths > 0
- **Then** "Repayment Schedule" card appears; shows Monthly EMI, Total Interest, Total Payable, Tenure KPIs

### TC-10-04 Show Month-by-Month toggles table
- **When** click "Show Month-by-Month" button
- **Then** amortization table appears with columns: #, Opening Balance, EMI, Principal, Interest, Closing Balance; row count = tenureMonths

### TC-10-05 Hide table button works
- **Given** amortization table is open
- **When** click "Hide Table"
- **Then** table disappears

### TC-10-06 Approval actions visible for actionable statuses
- **Given** loan is in SUBMITTED status
- **Then** buttons "Send to Review", "Credit Approve", "Reject", "Request More Info" visible

### TC-10-07 Action dialog requires comment for REJECT
- **When** click "Reject" → dialog opens
- **Then** submit button disabled until rejection reason typed

### TC-10-08 Action updates status
- **Given** SUBMITTED loan
- **When** click "Credit Approve" → confirm
- **Then** status chip updates to "Credit Approved"; timeline shows new entry

### TC-10-09 Approval timeline shows all events
- **Given** loan with 3 approval actions
- **Then** timeline shows 3 events in chronological order; each shows action, actor, and timestamp

### TC-10-10 Back button returns to list
- **When** click "Loan Applications" back button
- **Then** navigate back to /loans

---

## TC-11 · Frontend — Loan Application Form (SCRUM-179–182)

### TC-11-01 Form loads with product selection
- **When** navigate to /loans/new
- **Then** Step 1 (Personal Details) form visible; product type dropdown populated with 5 products

### TC-11-02 Form validates required fields before proceeding
- **When** click "Next" on Step 1 with empty fields
- **Then** validation errors shown; cannot proceed to Step 2

### TC-11-03 PAN format validation
- **When** enter invalid PAN "ABCDE1234"
- **Then** error: "Invalid PAN format"

### TC-11-04 Aadhaar last 4 digits
- **When** enter Aadhaar "1234-5678-9012"
- **Then** last 4 digits extracted; displayed as "XXXX-XXXX-XX12"

### TC-11-05 Step progress — 6 steps
- **Then** step indicator shows: 1. Personal/KYC → 2. Employment/Income → 3. Loan Parameters → 4. Co-Applicant → 5. Documents → 6. Review & Submit

### TC-11-06 EMI estimate in right rail (Step 3)
- **Given** Step 3 (Loan Parameters) visible
- **When** enter amount ₹5,00,000, tenure 36 months
- **Then** right rail shows estimated EMI using current product's interest rate

### TC-11-07 Eligibility check on Step 3
- **When** all income/CIBIL/amount fields filled; click "Check Eligibility"
- **Then** eligibility result shown: eligible/ineligible, max amount, recommended rate, FOIR

### TC-11-08 Review step shows summary
- **When** reach Step 6 (Review)
- **Then** all entered data shown in summary; Submit button visible

### TC-11-09 Successful submission
- **When** click Submit on Review step
- **Then** success message shown; application number displayed (format: LAP-xxx-xxxxxx)

---

## TC-12 · Demo Data Completeness (SCRUM-188)

### TC-12-01 All 3 tenants seeded
- **When** seeder runs for tenants public, ucb_demo, nbfc_demo
- **Then** each tenant has ≥ 5 loan applications

### TC-12-02 All status types represented
- **Then** seeded data includes applications in: DRAFT, SUBMITTED, IN_REVIEW, CREDIT_APPROVED, APPROVED, DISBURSED, REJECTED, INFO_REQUESTED

### TC-12-03 All product types represented
- **Then** seeded data includes: PERSONAL_LOAN, HOME_LOAN, BUSINESS_LOAN, GOLD_LOAN, VEHICLE_LOAN

### TC-12-04 Idempotent seeding
- **When** seeder runs twice (re-deploy scenario)
- **Then** no duplicate applications; count stays the same

### TC-12-05 Documents and actions seeded
- **Then** each application (except DRAFT) has at least 1 document and 1 approval action

---

## Test Data Reference

| # | Product | Status | Amount | CIBIL | Tenant Prefix |
|---|---------|--------|--------|-------|---------------|
| 1 | PERSONAL_LOAN | SUBMITTED | ₹5,00,000 | 745 | LAP-{PREFIX} |
| 2 | HOME_LOAN | IN_REVIEW | ₹45,00,000 | 782 | |
| 3 | BUSINESS_LOAN | CREDIT_APPROVED | ₹10,00,000 | 761 | |
| 4 | GOLD_LOAN | DISBURSED | ₹2,00,000 | 720 | |
| 5 | VEHICLE_LOAN | REJECTED | ₹8,00,000 | 618 | |
| 6 | PERSONAL_LOAN | DRAFT | ₹3,00,000 | 740 | |
| 7 | BUSINESS_LOAN | APPROVED | ₹7,50,000 | 785 | |
| 8 | HOME_LOAN | INFO_REQUESTED | ₹25,00,000 | 710 | |

---

*Generated for sprint planning — paste individual TC blocks into Jira story "Test Cases" section.*

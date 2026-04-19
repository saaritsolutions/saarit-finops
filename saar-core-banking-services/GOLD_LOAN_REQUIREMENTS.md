# Gold Loan Module — Requirements & Implementation Instructions

**Ticket ID:** SAAR-GL-001
**Created:** 2026-04-18
**Status:** IN DESIGN → APPROVED FOR DEVELOPMENT
**Priority:** High
**Reporter:** Product Owner
**Assignee:** Engineering
**Sprint:** Session 33+

---

## 1. Business Context

Gold loans are a critical product for Urban Co-operative Banks (UCBs) and NBFCs in India.
Gold is the primary collateral — there is no income check or CIBIL requirement.
The product is regulated by RBI (LTV cap 75%, 14-day auction notice mandatory).
Target market: UCBs (South India focus), NBFCs like Muthoot/Manappuram model.

**Market Opportunity:**
- India's gold loan market: ₹6.7 lakh crore (2025), growing at 14% CAGR
- UCBs are heavy users of jewel loans (South India terminology)
- Current system has a `GOLD_LOAN` product type seeded but no gold-specific domain logic

---

## 2. Functional Requirements

### FR-GL-001: Gold Pledge Register
**Priority:** P0 (Blocker for all other features)

The system must maintain a granular pledge register per loan:
- Capture individual ornament/bar items: type, gross weight, stone deduction, net weight, purity (carats)
- Auto-compute: purity factor (carats/24), valued amount (net weight × purity factor × market rate)
- Assign physical packet number and optional vault location
- Support item types: NECKLACE | BANGLE | RING | COIN | BAR | ANKLET | EARRING | OTHER
- Mark items as released on loan closure

**Acceptance Criteria:**
- [ ] Branch user can add multiple pledge items per application
- [ ] Each item's valued amount is auto-calculated
- [ ] Total net weight and total valued amount are computed from sum of items
- [ ] Max eligible loan = 75% of total valued amount (LTV rule)
- [ ] Items can be removed while application is in DRAFT status only

---

### FR-GL-002: Gold Rate Master (Daily Rate Entry)
**Priority:** P0 (required for LTV calculation)

- Admin user enters the IBJA 22-carat gold rate per gram daily
- Rate is stored with date, source (MANUAL/IBJA/MCX), and entered-by
- Rate drives: pledge valuation at origination + LTV monitoring
- Each RateDate must be unique per tenant (no duplicate entries for same day)

**Acceptance Criteria:**
- [ ] Admin can enter rate once per day (duplicate date rejected)
- [ ] Rate is visible to branch users for valuation reference
- [ ] If no rate for today, system shows last available rate with warning
- [ ] Rate history (last 30 days) is viewable

---

### FR-GL-003: Loan Scheme Selection
**Priority:** P0

Support 4 repayment schemes:

| Scheme | Description | Tenure |
|---|---|---|
| BULLET | All principal + interest at maturity | 3–12 months |
| EMI | Monthly reducing balance EMI | 6–36 months |
| INTEREST_ONLY | Monthly interest, principal at end | 3–24 months |
| OD | Revolving overdraft — interest on drawn amount | 12 months (renewable) |

**Phase 1:** BULLET scheme only
**Phase 2:** EMI + INTEREST_ONLY
**Phase 5:** OD (requires AccountService integration)

**Acceptance Criteria (Phase 1):**
- [ ] BULLET scheme is available at origination
- [ ] Tenure selection: 3, 6, 9, 12 months
- [ ] Maturity date computed = DisbursedAt + TenureMonths
- [ ] Interest rate set from LoanProduct.BaseRatePercent + spread based on LTV band

---

### FR-GL-004: Gold Loan Lifecycle
**Priority:** P0

Full state machine:

```
DRAFT → SUBMITTED → APPRAISED → SANCTIONED → DISBURSED
  → [bullet] → CLOSED
  → [ltv breach] → MARGIN_CALL_OPEN → AUCTION_NOTICE_ISSUED → AUCTION_SETTLED
```

**States:**
| Status | Description |
|---|---|
| DRAFT | Application being filled |
| SUBMITTED | Customer submitted, waiting appraisal |
| APPRAISED | Appraiser recorded weights and purity |
| SANCTIONED | LTV verified, pledge receipt issued, ready to disburse |
| DISBURSED | Funds released, GL posted |
| CLOSED | Loan repaid, gold released |
| MARGIN_CALL_OPEN | LTV breach — customer notified |
| AUCTION_NOTICE_ISSUED | 14-day statutory notice issued |
| AUCTION_SETTLED | Auction conducted, proceeds applied |

**Acceptance Criteria:**
- [ ] Each state transition is logged in LoanApprovalAction (audit trail)
- [ ] Only SANCTIONED loans can be disbursed
- [ ] Only DISBURSED loans can be closed/margin-called
- [ ] Pledge receipt number generated on SANCTIONED transition
- [ ] Gold marked as released on CLOSED transition

---

### FR-GL-005: GL Accounting (Double Entry)
**Priority:** P0

| Event | Dr | Cr |
|---|---|---|
| Disbursal | 1025 Gold Loans Outstanding | 1010 Cash and Bank |
| Bullet Closure | 1010 Cash and Bank | 1025 Gold Loans Outstanding |
| Bullet Closure (interest) | 1010 Cash and Bank | 4015 Gold Loan Interest Income |
| Auction | 1010 Cash and Bank | 1025 Gold Loans Outstanding |
| Auction Surplus | 2040 Other Liabilities | 1010 Cash and Bank |
| Auction Charges | 5050 Auction Expenses | 1010 Cash and Bank |

**New GL Accounts Required:**
- 1025 — Gold Loans Outstanding (Asset, Debit normal)
- 2050 — Gold in Custody (Liability, Credit normal) — custodial accounting
- 4015 — Gold Loan Interest Income (Income, Credit normal)
- 5050 — Auction Expenses (Expense, Debit normal)

**Acceptance Criteria:**
- [ ] Disbursal posts journal to TransactionService with idempotency key
- [ ] Journal number stored in LoanApplication.DisbursalJournalNumber
- [ ] Closure posts 3-line journal (cash in / principal out / interest income)
- [ ] All journals are viewable via JournalDetailDialog (existing component)

---

### FR-GL-006: LTV Monitoring (Phase 3)
**Priority:** P1

- Daily batch (IHostedService) runs at 9:00 AM after gold rate is entered
- Recomputes gold value for all DISBURSED loans using today's rate
- If LTV > 75%: auto-creates MarginCall record, status = OPEN
- MarginCall stores: current gold value, outstanding, LTV%, shortfall required
- 7-day response window for customer

**Acceptance Criteria (Phase 3):**
- [ ] Manual "Run LTV Monitor" button on Gold Rate Admin page
- [ ] Breach count shown on Gold Loans Dashboard
- [ ] Margin call list with status per loan
- [ ] Email/SMS notification (future — not in Phase 3 scope)

---

### FR-GL-007: Auction Workflow (Phase 4)
**Priority:** P2 (Regulatory mandatory — but can be Phase 4)

- 14-day minimum notice period (RBI mandatory)
- Notice must be issued in same district as pledging branch
- Auction proceeds applied: outstanding + charges first, surplus returned to customer
- Surplus must be returned within 7 days
- Shortfall becomes unsecured claim

**Acceptance Criteria (Phase 4):**
- [ ] Auction notice created with AuctionScheduledAt = NoticeIssuedAt + 14 days
- [ ] Auction outcome recorded: proceeds, outstanding, charges, surplus/shortfall
- [ ] Surplus returned date tracked
- [ ] GL journal for auction posted (3-line: proceeds / outstanding / surplus)

---

### FR-GL-008: Appraiser Management
**Priority:** P1

- Appraiser name and employee ID recorded on each loan (from GoldLoanDetails)
- Future: Appraiser master table with certification status (out of scope for Phase 1)

---

## 3. Non-Functional Requirements

| NFR | Requirement |
|---|---|
| Multi-tenancy | All gold loan data is schema-isolated per tenant (public, ucb_demo, nbfc_demo) |
| Idempotency | GL journals use unique idempotency keys — safe to retry |
| Audit | Every state transition logged in LoanApprovalAction |
| Security | All endpoints require JWT; tenant_id claim enforced |
| Compliance | LTV cap 75% enforced at sanction; auction notice 14-day minimum enforced |
| Data privacy | Aadhaar: last 4 digits only; PAN stored as-is |
| Regulatory | Auction notice generation must be archived (Document store — Phase 4+) |

---

## 4. Out of Scope (Explicitly)

- OD (overdraft) scheme — Phase 5 only
- Auto-renewal scheduling — Phase 5
- SMS/Email notifications — future sprint
- Gold price API integration (IBJA) — manual rate entry in Phase 1–4
- Hallmark certificate verification — future
- Integration with government portals (CERSAI) — regulatory sprint
- Gold insurance premium billing — future

---

## 5. Architectural Decision

**Decision:** Implement Gold Loan as a sub-module inside LoanService (Option C — Hybrid)
**ADR:** ADR-013-gold-loan-architecture.md
**Rationale:**
- LoanService already has GOLD_LOAN product seeded and multi-tenancy boilerplate
- Folder-level isolation (Models/Gold/, Controllers/Gold/, Services/Gold/) creates clear domain boundary
- Extractable to GoldLoanService microservice later with minimal refactoring
- Zero new infrastructure (no new port, docker-compose, nginx routing, CI step)

---

## 6. Data Model Summary

### New Entities (LoanService — Gold/ subfolder)

| Entity | Type | Purpose |
|---|---|---|
| GoldLoanDetails | 1:1 with LoanApplication | Scheme, tenure, appraiser, vault location, totals |
| GoldPledgeItem | 1:N with GoldLoanDetails | Individual ornament: weight, purity, value, packet# |
| GoldRateMaster | Standalone | Daily IBJA rate log |
| MarginCall | 1:N with GoldLoanDetails | LTV breach events (Phase 3) |
| AuctionNotice | 1:N with GoldLoanDetails | Statutory auction notices (Phase 4) |

---

## 7. API Surface Summary

### GoldLoanController (`/api/gold-loan`)
| Method | Endpoint | Phase |
|---|---|---|
| POST | `/applications` | 1 |
| GET | `/applications` | 1 |
| GET | `/applications/{id}` | 1 |
| POST | `/applications/{id}/pledge-items` | 1 |
| DELETE | `/applications/{id}/pledge-items/{itemId}` | 1 |
| POST | `/applications/{id}/sanction` | 1 |
| POST | `/applications/{id}/disburse` | 1 |
| POST | `/applications/{id}/repay` | 1 |
| POST | `/applications/{id}/close` | 1 |
| POST | `/applications/{id}/margin-calls` | 3 |
| PATCH | `/margin-calls/{id}/respond` | 3 |
| POST | `/applications/{id}/auction-notices` | 4 |
| POST | `/auction-notices/{id}/conduct` | 4 |
| GET | `/ltv-report` | 3 |

### GoldRateController (`/api/gold-rate`)
| Method | Endpoint | Phase |
|---|---|---|
| GET | `/today` | 1 |
| GET | `/` | 1 |
| POST | `/` | 1 |

---

## 8. Frontend Screens

| Screen | Route | Phase |
|---|---|---|
| Gold Loan List | `/gold-loans` | 1 |
| New Gold Loan Origination | `/gold-loans/new` | 1 |
| Gold Loan Detail | `/gold-loans/:id` | 1 |
| Gold Rate Admin | `/admin/gold-rate` | 1 |

---

## 9. Implementation Phases

### Phase 1 — Core Origination + Bullet Repayment (THIS SPRINT)
**Definition of Done:**
- [ ] GoldLoanDetails + GoldPledgeItem + GoldRateMaster entities + EF migration
- [ ] GoldLoanController: create, pledge items, sanction, disburse, close
- [ ] GoldRateController: today's rate, history, entry
- [ ] GL accounts 1025, 4015, 2050, 5050 seeded in TransactionService
- [ ] GL journals posted for disbursal and closure
- [ ] Frontend: 5-step origination form, list, detail (pledge items tab)
- [ ] Gold Loan stat card on Dashboard
- [ ] End-to-end: apply → appraise → sanction → disburse → repay → close

### Phase 2 — EMI + Interest-Only Schemes
- RepaymentSchedule entity
- EMI calculation endpoint
- Interest accrual IHostedService
- Frontend: Repayment tab

### Phase 3 — LTV Monitoring + Margin Calls
- MarginCall entity + EF migration
- LTV monitor IHostedService (daily batch)
- Frontend: LTV tab, breach alert badges

### Phase 4 — Auction Workflow
- AuctionNotice entity + EF migration
- Auction GL journal
- Frontend: Auction tab

### Phase 5 — OD + Renewal
- OD account linkage via AccountService
- Renewal endpoint + top-up

---

## 10. Test Plan

### Unit Tests (LoanService.Tests)
- [ ] GoldLoanController_Create_ReturnsBadRequest_WhenNoPledgeItems
- [ ] GoldLoanController_Sanction_ComputesLTV_Correctly
- [ ] GoldLoanController_Sanction_Rejects_WhenLTV_Exceeds75
- [ ] GoldRateService_GetTodayRate_ReturnsLastAvailable_WhenNoTodayEntry

### Integration / Manual Test Flow
1. Enter today's gold rate: POST /api/gold-rate (₹7,500/gram, 22K)
2. Create gold loan application: POST /api/gold-loan/applications
3. Add pledge item: 22K necklace, 20g gross, 1g stone → 19g net, valued ₹1,35,937
4. Sanction: LTV at ₹1,00,000 = 73.6% < 75% ✓ → SANCTIONED
5. Disburse: GL posted DR 1025 / CR 1010
6. Repay (bullet): GL posted DR 1010 / CR 1025 + CR 4015
7. Close: pledge items marked released, GoldReleasedAt set
8. Verify journal via JournalDetailDialog on UI

### Regression Cypress (Phase 1 complete)
- Add `cypress/e2e/regression/goldloan.cy.ts`
- Mock API responses, test list/create/detail flows

---

## 11. Dependencies

| Dependency | Status |
|---|---|
| LoanService (existing) | LIVE |
| TransactionService GL posting | LIVE |
| JournalDetailDialog component | LIVE |
| WorkflowOrchestrationService | LIVE (optional in Phase 1) |
| Gold price API (IBJA) | NOT integrated — manual entry in Phase 1–4 |

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| EF migration schema qualifier issue | Strip `schema:"public"` from generated migration (standard process — see MEMORY.md) |
| TransactionService GL account 1025 not seeded | Add to LedgerSeedService before testing |
| Locked .exe on Windows during migration | Kill dotnet processes before running ef migrations add |

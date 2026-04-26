# SAAR-CST-001 — CustomerService: Pagination, Search & Demo Seeder

| Field        | Value |
|---|---|
| Ticket ID    | SAAR-CST-001 |
| Status       | In Progress |
| Module       | Customer Information File (CIF) |
| Service      | CustomerService (port 5200) |
| Priority     | Medium |
| Session      | 47 |

---

## Problem Statement

`GET /api/customer` currently returns ALL customers with no filtering, no pagination, and no demo
data. This causes two problems:
1. The customer table is always empty on a fresh deploy — the UI shows "No customers yet" which
   makes demo/review useless.
2. As the customer base grows, returning all records at once becomes a performance and UX issue.

---

## Functional Requirements

### FR-1 — Server-side pagination
- `GET /api/customer` accepts query params: `page` (default 1), `pageSize` (default 20)
- Response changes from `Customer[]` to `{ total, items, page, pageSize }`
- Backend applies `.OrderByDescending(c => c.CreatedAt).Skip(...).Take(...)`
- Total count reflects filtered row count (not all rows)

### FR-2 — Server-side search
- Query param: `search` (optional, free-text)
- Searched fields: `FirstName`, `LastName`, `Mobile`, `Email`, `PAN`
- Case-insensitive contains match
- Blank/null `search` returns all records (no filter applied)

### FR-3 — KYC Status filter
- Query param: `kycStatus` (optional)
- Accepted values: `"ALL"` (no filter) or `"0"` through `"5"` (enum int)
- Absent or `"ALL"` → no filter applied

### FR-4 — Customer Type filter
- Query param: `customerType` (optional)
- Accepted values: `"ALL"`, `"Individual"`, `"Corporate"`, `"NRI"`, `"Government"`
- Absent or `"ALL"` → no filter applied

### FR-5 — Demo Data Seeder
- On service startup, seed 8 customers per tenant (`public`, `ucb_demo`, `nbfc_demo`)
- Idempotent: skip records that already exist (checked by `Mobile`)
- Covers all 6 KYC states + all relevant customer types

**Seed data:**

| Name | Type | KYC State | Mobile |
|---|---|---|---|
| Ramesh Kumar | Individual | Verified (3) | 9876543210 |
| Priya Sharma | Individual | InProgress (1) | 9123456780 |
| Anjali Mehta | Individual | DocumentsSubmitted (2) | 9000111222 |
| Vikram Nair | Individual | Rejected (4) | 9000333444 |
| Sunita Patel | Individual | NotStarted (0) | 9000555666 |
| Arun Iyer | NRI | Verified (3) | 9000777888 |
| MegaCorp Ltd | Corporate | Verified (3) | 9000999000 |
| Kavita Singh | Individual | Expired (5) | 9001111222 |

### FR-6 — Frontend: Filter bar
- Search text input (name/mobile/email/PAN)
- KYC Status dropdown
- Customer Type dropdown
- Search button + Reset button
- Dropdowns auto-load on change; Search input loads on button click or Enter

### FR-7 — Frontend: Pagination
- MUI `<Pagination>` component below the table
- "Showing X–Y of Z customers" label
- Changing page auto-loads from API

---

## Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-1 | `GET /api/customer` returns `{ total, items, page, pageSize }` |
| AC-2 | `GET /api/customer?search=ram` returns only customers whose name/mobile/email/PAN contains "ram" |
| AC-3 | `GET /api/customer?kycStatus=3` returns only Verified customers |
| AC-4 | `GET /api/customer?customerType=Corporate` returns only Corporate customers |
| AC-5 | `GET /api/customer?page=2&pageSize=5` returns items 6–10 |
| AC-6 | Fresh deploy: `GET /api/customer` returns 8 seeded customers per tenant |
| AC-7 | Running service twice does not duplicate seed records |
| AC-8 | UI shows filter bar above the table |
| AC-9 | UI shows pagination control below the table |
| AC-10 | Existing Cypress regression tests continue to pass (stubs updated) |

---

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | No new EF migration required (no schema changes) |
| NFR-2 | Seeder is idempotent — safe to run on every startup |
| NFR-3 | `dotnet build` 0 errors after changes |
| NFR-4 | 21+ NUnit tests pass (17 existing + 4 new) |

---

## Out of Scope

- Server-side sorting (order by field/direction)
- Export to CSV / Excel
- Advanced date-range filters
- Customer deduplication check during seed

---

## Test Plan

### Unit Tests (NUnit — CustomerControllerTests.cs)
1. `GetCustomers_ReturnsAllWhenNoFilter` — no params → all 3 seeded customers returned
2. `GetCustomers_FiltersBy_Search_Name` — `search=John` → only John returned
3. `GetCustomers_FiltersBy_KycStatus` — `kycStatus=3` → only Verified returned
4. `GetCustomers_ReturnsCorrectPage` — `page=2, pageSize=1` → second record only

### Cypress Regression Tests (06-customers.cy.ts)
- All existing stubs updated to `{ body: { total, items, page, pageSize } }`
- New describe block `[REGRESSION] Customer Pagination + Search`:
  1. Search input is visible on the page
  2. KYC Status filter dropdown exists
  3. Pagination shown when `total > pageSize` (stub: total=25, 20 items)

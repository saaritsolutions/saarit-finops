# SAAR-KYC-001 — KYC Workflow for CustomerService

**Ticket ID:** SAAR-KYC-001
**Status:** In Progress
**Epic:** Customer Lifecycle Management
**Service:** CustomerService
**Sprint:** 2026-04-26
**Author:** saaritsolutions

---

## 1. Background

CustomerService already stores a 6-state `KycStatus` enum and audit columns
(`KycVerifiedAt`, `KycVerifiedBy`, `KycRejectionReason`) from the `AddKycStatus` migration
(2026-03-28). However, no API endpoints exist to transition these states — the frontend
displays KYC status as a read-only chip.

This ticket wires up the full KYC state machine: **Initiate → Submit Documents →
Verify / Reject**, including action buttons in the UI and backend validation to reject
invalid transitions.

---

## 2. KYC State Machine

```
NotStarted(0) ──initiate──► InProgress(1) ──submit-docs──► DocumentsSubmitted(2)
                                │                                  │         │
                             reject                             verify     reject
                                │                                  │         │
                            Rejected(4)                       Verified(3) Rejected(4)
                                                                   │
                                                                expire
                                                                   │
                                                              Expired(5)
```

| State | Int | Description |
|---|---|---|
| NotStarted | 0 | Default on customer creation |
| InProgress | 1 | KYC process initiated |
| DocumentsSubmitted | 2 | Customer has submitted identity documents |
| Verified | 3 | KYC approved by bank officer |
| Rejected | 4 | KYC failed — reason recorded |
| Expired | 5 | Verified KYC has passed re-KYC deadline |

---

## 3. Functional Requirements

### FR-KYC-001 — Initiate KYC
- **Endpoint:** `POST /api/customer/{id}/kyc/initiate`
- **Valid source state:** `NotStarted (0)`
- **Transition:** `NotStarted → InProgress`
- **Audit:** Sets `KycVerifiedBy = User.Identity.Name ?? "system"` (not a final verifier — recorded as initiator)
- **AC-01:** Returns `200 OK { kycStatus: 1, message: "KYC initiated" }` on success
- **AC-02:** Returns `422 Unprocessable Entity` if already `InProgress` or beyond
- **AC-03:** Returns `404 Not Found` if customer doesn't exist

### FR-KYC-002 — Submit Documents
- **Endpoint:** `POST /api/customer/{id}/kyc/submit-documents`
- **Valid source state:** `InProgress (1)`
- **Transition:** `InProgress → DocumentsSubmitted`
- **AC-01:** Returns `200 OK { kycStatus: 2, message: "Documents submitted" }`
- **AC-02:** Returns `422` if not currently `InProgress`

### FR-KYC-003 — Verify KYC
- **Endpoint:** `POST /api/customer/{id}/kyc/verify`
- **Request body:** `{ "verifiedBy": "Officer Name" }` (required)
- **Valid source state:** `DocumentsSubmitted (2)`
- **Transition:** `DocumentsSubmitted → Verified`
- **Audit:** Sets `KycVerifiedAt = UtcNow`, `KycVerifiedBy = request.VerifiedBy`
- **AC-01:** Returns `200 OK { kycStatus: 3, message: "KYC verified" }`
- **AC-02:** Returns `422` if not `DocumentsSubmitted` (e.g. cannot verify from `InProgress`)
- **AC-03:** Returns `400` if `verifiedBy` is empty

### FR-KYC-004 — Reject KYC
- **Endpoint:** `POST /api/customer/{id}/kyc/reject`
- **Request body:** `{ "rejectionReason": "Documents unclear" }` (required)
- **Valid source states:** `InProgress (1)` OR `DocumentsSubmitted (2)`
- **Transition:** → `Rejected`
- **Audit:** Sets `KycRejectionReason = request.RejectionReason`
- **AC-01:** Returns `200 OK { kycStatus: 4, message: "KYC rejected" }`
- **AC-02:** Returns `422` if state is `NotStarted`, `Verified`, or `Expired`
- **AC-03:** Returns `400` if `rejectionReason` is empty

### FR-KYC-005 — Expire KYC
- **Endpoint:** `POST /api/customer/{id}/kyc/expire`
- **Valid source state:** `Verified (3)`
- **Transition:** `Verified → Expired`
- **AC-01:** Returns `200 OK { kycStatus: 5, message: "KYC expired — re-KYC required" }`
- **AC-02:** Returns `422` if not `Verified`

### FR-KYC-006 — Audit Field Capture
- All state transitions must record audit data:
  - Verify: `KycVerifiedAt`, `KycVerifiedBy`
  - Reject: `KycRejectionReason`
  - All: persisted to DB atomically with status change

---

## 4. Non-Functional Requirements

### NFR-01 — Invalid Transition Protection
Any attempt to transition from an invalid source state returns `422 Unprocessable Entity`
with a human-readable message (`"KYC must be In Progress to submit documents"`).
Never returns `500`.

### NFR-02 — Audit Completeness
All transitions are captured in existing audit columns. No data loss on concurrent requests
(last-writer-wins acceptable at this scale).

### NFR-03 — Backwards Compatibility
Existing CRUD endpoints (`GET`, `POST`, `PUT`, `DELETE`) are unchanged. The `kycStatus`
field returned by `GET /api/customer` and `GET /api/customer/{id}` continues to work as before.

---

## 5. Out of Scope

- Document file upload (PDFs/images) — `Passport`, `DrivingLicense`, `VoterId` remain string fields
- External KYC bureau integration (CKYC, UIDAI/Aadhaar XML)
- Automated re-KYC scheduling / expiry reminders
- Maker-Checker enforcement for KYC verification (SCRUM-9 backlog)
- Bulk KYC status updates

---

## 6. Test Plan

### Backend Unit Tests (CustomerControllerTests.cs — 6 new tests)
| Test | Expected |
|---|---|
| `KycInitiate_TransitionsToInProgress` | HTTP 200, kycStatus=1 |
| `KycSubmitDocuments_TransitionsToDocumentsSubmitted` | HTTP 200, kycStatus=2 |
| `KycVerify_TransitionsToVerified_WithAuditFields` | HTTP 200, kycStatus=3, KycVerifiedAt set |
| `KycReject_TransitionsToRejected_WithReason` | HTTP 200, kycStatus=4, reason saved |
| `KycInitiate_Returns404_WhenCustomerNotFound` | HTTP 404 |
| `KycVerify_Returns422_WhenInvalidTransition` | HTTP 422 (verify from InProgress) |

### Cypress Regression Tests (06-customers.cy.ts — 5 new tests)
| Test | Assertion |
|---|---|
| Initiate KYC button visible for NotStarted customer | aria-label="Initiate KYC" exists |
| Submit Docs button visible for InProgress customer | aria-label="Submit Documents" exists |
| Verify + Reject buttons visible for DocumentsSubmitted customer | both buttons exist |
| Successful verify updates KYC chip to Verified | chip text changes |
| Reject dialog shows reason field + cancels | dialog renders, Cancel closes it |

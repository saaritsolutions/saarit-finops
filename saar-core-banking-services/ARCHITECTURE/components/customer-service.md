# CustomerService

## Purpose
Customer Information File (CIF) management — the master record for all bank customers.

## Port
`:5200`

## Responsibilities
- Create and maintain customer master records (CIF)
- KYC document management and verification status
- AML watchlist screening (RBI/FATF lists)
- Customer deduplication (PAN/Aadhaar matching)
- Customer relationship tracking (introducer, guarantor)
- CKYC (Central KYC Registry) integration

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/customer` | List customers (paginated, searchable) |
| GET | `/api/customer/{id}` | Get customer by ID |
| POST | `/api/customer` | Create new customer (CIF) |
| PUT | `/api/customer/{id}` | Update customer details |
| DELETE | `/api/customer/{id}` | Soft-delete (deactivate) customer |
| POST | `/api/customer/validate/pan` | Validate PAN format |
| POST | `/api/customer/validate/aadhaar` | Validate Aadhaar format |
| POST | `/api/customer/{id}/kyc` | Submit KYC documents |
| GET | `/api/customer/{id}/accounts` | Get customer's accounts |
| POST | `/api/customer/search` | Search by name, PAN, mobile, Aadhaar |

## Data Model
```
Customer (CIF)
├── CustomerId (GUID)
├── CifNumber (sequential, bank-specific)
├── Salutation, FirstName, MiddleName, LastName
├── DateOfBirth, Gender
├── Mobile, Email, AlternatePhone
├── PAN (encrypted), UID/Aadhaar (encrypted)
├── CustomerType: INDIVIDUAL | CORPORATE | GOVERNMENT | NRI
├── KycStatus: PENDING | SUBMITTED | VERIFIED | REJECTED | EXPIRED
├── KycDocuments: [ { docType, docNumber, expiryDate, verifiedBy } ]
├── PostalAddress, PermanentAddress
├── AmlStatus: CLEAR | FLAGGED | BLOCKED
├── IntroducedBy (CustomerId reference)
├── IsActive
└── AuditFields (CreatedBy, CreatedAt, UpdatedBy, UpdatedAt)
```

## PII Handling
- `PAN`: encrypted at rest (AES-256), masked in API responses (ABCDE****F)
- `UID/Aadhaar`: encrypted at rest, never returned in full via API
- `Mobile`: last 4 digits visible, full number encrypted

## Domain Events Published
- `CustomerCreated` — new CIF created
- `CustomerVerified` — KYC accepted by officer
- `CustomerFlagged` — AML match detected

## IDRBT Requirements Met
- Section 2: Customer Information System
- Section 2.1: CIF with unique customer ID across branches
- Section 2.3: KYC compliance (RBI KYC Master Directions 2016)
- PMLA 2002: AML screening requirement

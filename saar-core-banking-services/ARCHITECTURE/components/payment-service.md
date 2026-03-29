# PaymentService

## Purpose
All interbank and intrabank payment processing: NEFT, RTGS, IMPS, NACH/ECS, Demand Draft, and internal fund transfers.

## Port
`:5014`

## Responsibilities
- NEFT batch processing (RBI SFMS integration)
- RTGS high-value transfer processing
- IMPS instant payment (NPCI NFS)
- NACH/ECS batch debit/credit processing
- Demand Draft (DD) issuance and payment
- Cheque clearing (MICR, CTS grid)
- UPI transaction handling
- Payment status tracking and reconciliation
- Failed payment reversal and auto-refund

## Payment Rails Supported
| Rail | Type | Limit | Settlement |
|---|---|---|---|
| NEFT | Batch | No upper limit | 30-minute windows |
| RTGS | Real-time | Min ₹2 lakh | Continuous (RTGS hours) |
| IMPS | Instant | ₹5 lakh | 24×7 immediate |
| NACH (ECS) | Batch | Per mandate | T+1 |
| UPI | Instant | ₹1 lakh | 24×7 immediate |
| Demand Draft | Physical | No limit | On presentation |
| Cheque CTS | Batch | No limit | T+1 (inter-city) |

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| POST | `/api/payment/neft` | Initiate NEFT transfer |
| POST | `/api/payment/rtgs` | Initiate RTGS transfer |
| POST | `/api/payment/imps` | Initiate IMPS transfer |
| POST | `/api/payment/dd` | Issue Demand Draft |
| GET | `/api/payment/{id}/status` | Payment status |
| POST | `/api/payment/{id}/cancel` | Cancel pending payment |
| POST | `/api/payment/nach/batch` | Submit NACH batch |
| GET | `/api/payment/pending` | List pending payments (for maker-checker) |
| POST | `/api/payment/{id}/approve` | Checker approval |

## Payment State Machine
```
DRAFT → PENDING_CHECK → APPROVED → SUBMITTED → SETTLED
     ↘               ↘           ↘
       CANCELLED       REJECTED    FAILED → REVERSED
```

## Maker-Checker Rules for Payments
```
Amount < ₹10,000:     Auto-post (no maker-checker)
₹10,000 – ₹50,000:   Officer approval required
₹50,000 – ₹2,00,000: Branch Manager approval required
> ₹2,00,000:          Two-level approval (Officer + Branch Manager)
```

## RBI SFMS Integration (NEFT/RTGS)
```csharp
public class SfmsClient
{
    // Connects to RBI's Structured Financial Messaging System
    // Message format: ISO 20022 (XML) for RTGS
    //                 RBI proprietary format for NEFT
    // Transport: SFMS leased line / VPN

    public async Task<SfmsResponse> SubmitNeftAsync(NeftMessage message)
    public async Task<SfmsResponse> SubmitRtgsAsync(RtgsMessage message)
    public async Task<BatchResult> ReceiveInwardBatchAsync()
}
```

## Domain Events Published
- `PaymentInitiated`
- `PaymentProcessed` → AccountService: debit; GL: posting
- `PaymentFailed` → AccountService: release hold; Notification: alert customer
- `PaymentSettled` → AccountService: credit (inward); GL: settlement entry

## IDRBT Requirements Met
- Section 9: Electronic fund transfer
- Section 9.1: NEFT/RTGS integration with RBI SFMS
- Section 9.2: IMPS/NACH integration with NPCI
- Section 9.3: Cheque management and CTS clearing
- NPCI SLAs: IMPS response within 30 seconds

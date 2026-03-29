# NotificationService

## Purpose
Multi-channel notification delivery: SMS, email, and in-app alerts for customer-facing events and internal staff alerts.

## Port
`:5015`

## Responsibilities
- SMS notifications to customers (transaction alerts, OTP, loan status)
- Email notifications (account statements, loan sanction letters, NOC)
- In-app push notifications to branch staff (pending maker-checker, EOD alerts)
- Notification template management (bank-customizable templates)
- Delivery status tracking (sent, delivered, failed)
- Rate limiting (prevent notification flood to a customer)
- Scheduled notifications (maturity reminders 7 days before FD maturity)
- Regulatory notifications (NPA demand notices via registered post — physical)

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| POST | `/api/notification/send` | Send notification (internal use) |
| GET | `/api/notification/{id}/status` | Delivery status |
| GET | `/api/notification/history/{customerId}` | Customer notification history |
| POST | `/api/notification/template` | Create/update notification template |
| GET | `/api/notification/templates` | List templates |
| POST | `/api/notification/bulk` | Bulk notification (e.g., rate change announcement) |

## Notification Channels
| Channel | Provider | Use Case |
|---|---|---|
| SMS | Twilio / MSG91 / SMSC (TRAI registered) | Transaction alerts, OTP, EMI reminders |
| Email | SendGrid / SES (India region) | Statements, letters, bulk announcements |
| In-App | WebSocket / SSE | Staff alerts, pending approvals, EOD status |
| WhatsApp | WhatsApp Business API | (Phase 2) Statement delivery, loan updates |

## Notification Templates (Bank-Customizable)
```
Template: CASH_DEBIT
SMS: "Dear {customerName}, INR {amount} debited from A/c {maskedAccount} on {date}. Avl Bal: INR {balance}. -{bankShortName}"

Template: LOAN_EMI_REMINDER
SMS: "Dear {customerName}, EMI of INR {emiAmount} for loan {loanNumber} is due on {dueDate}. Please ensure adequate balance. -{bankShortName}"

Template: FD_MATURITY_REMINDER
Email Subject: "FD Maturity Notice — {fdNumber}"
Email Body: "Your Fixed Deposit {fdNumber} of INR {amount} matures on {maturityDate}.
             Auto-renewal: {autoRenewalStatus}. Contact branch to modify."
```

## Event-Driven Triggers
NotificationService subscribes to domain events and sends appropriate notifications:
```
AccountDebited       → SMS: debit alert to customer
AccountCredited      → SMS: credit alert to customer (if amount > threshold)
LoanSanctioned       → Email + SMS: sanction intimation to customer
LoanDisbursed        → SMS: disbursement credit alert
InstallmentOverdue   → SMS: EMI overdue reminder (Day 1, Day 7, Day 30)
FdMatured            → SMS + Email: maturity notice
MakerCheckerPending  → In-App: alert to checker role users
EodStarted           → In-App: alert to branch managers
EodCompleted         → In-App: EOD completion with duration
EodFailed            → SMS: alert to Bank Admin (urgent)
```

## Rate Limiting
```
Customer SMS limit: max 5 SMS per customer per hour (prevent spam)
Customer email limit: max 10 emails per customer per day
Bulk notification: max 1000 per batch, with throttling
OTP: max 3 resends per 10 minutes (prevent abuse)
```

## IDRBT Requirements Met
- Section 14: Customer notification facility
- IDRBT Annexure II: Transaction alerts mandatory for all debits/credits
- RBI KYC: OTP delivery for digital channel authentication
- TRAI DLT compliance: All SMS templates registered on TRAI DLT platform

# ADR-004: Event-Driven Architecture

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-03-29 |
| Deciders | SaaR Architecture Team |
| Regulatory Ref | IDRBT Annexure II — Audit trail, data integrity; RBI Outage reporting |

---

## Context

Core Banking operations are inherently event-rich: an account debit triggers interest calculation, GL posting, notification, audit recording, and potentially NPA reclassification. These downstream effects must be:
- **Reliable** — a payment cannot be lost even if a downstream service is temporarily unavailable
- **Ordered** — per-account events must be processed in sequence (debit before NPA check)
- **Traceable** — every state change must be auditable (RBI requirement)
- **Decoupled** — adding a new downstream effect (e.g., CKYC update) should not require changing the payment code

The challenge: in-process events are simple but fragile; external message brokers add operational overhead.

---

## Decision Options Considered

### Option A: Direct Service Calls (synchronous)
```
PaymentService → calls AccountService.Debit() → calls GL.Post() → calls Audit.Record()
Pros: Simple, consistent, easy to debug
Cons:
  - Tight coupling between services
  - If Audit service is slow, payment is slow
  - If GL service is down, payment fails (even if money moved)
  - Chain grows as features are added
Rejected: Violates open/closed principle, creates availability coupling
```

### Option B: In-Process Events (MediatR) — Phase 1
```
PaymentService publishes PaymentProcessed event in-process.
Handlers: AccountHandler, GlHandler, AuditHandler, NotificationHandler
Pros:
  - Zero infrastructure overhead
  - Transactional: handlers run in same DB transaction (if needed)
  - Easy to add new handlers
  - Great for development and early phase
Cons:
  - Events lost if process crashes between publishing and handling
  - Cannot span process boundaries (same-service-only)
  - Cannot replay events
Chosen for Phase 1
```

### Option C: External Message Broker (Kafka/Azure Service Bus) — Phase 2
```
Events written to Kafka topic; consumers in other services subscribe.
Pros:
  - Events persist even across process restarts
  - Cross-service event delivery
  - Event replay: rebuild read model from history
  - Consumer lag monitoring
Cons:
  - Operational overhead: Kafka cluster to manage
  - Eventual consistency requires careful design
  - Harder to debug locally
Chosen for Phase 2 (when cross-service events needed)
```

### Option D: Database as Message Queue (polling pattern)
```
Write events to a DB table; consumers poll.
Pros: Simple, transactional
Cons: Polling latency, DB load, not scalable at CBS scale
Rejected: Polling pattern is fragile at high TPS
```

---

## Decision: Outbox Pattern (Phase 1) → Kafka (Phase 2)

The **Outbox Pattern** bridges both phases:
1. Events are written to an `outbox` table **in the same DB transaction** as the business change
2. A background worker reads unprocessed outbox entries and publishes them to MediatR (Phase 1) or Kafka (Phase 2)
3. This guarantees **at-least-once delivery** even if the process crashes

### Outbox Table
```sql
CREATE TABLE outbox_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_on     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type      TEXT NOT NULL,           -- e.g., 'PaymentProcessed'
    payload         JSONB NOT NULL,          -- serialized event
    processed_at    TIMESTAMPTZ,             -- NULL = pending
    error           TEXT,                   -- last error if failed
    retry_count     INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_outbox_unprocessed ON outbox_messages (occurred_on)
    WHERE processed_at IS NULL;
```

### Outbox Worker (Hangfire job, every 5 seconds)
```csharp
public class OutboxProcessingJob
{
    public async Task ExecuteAsync()
    {
        var messages = await _db.OutboxMessages
            .Where(m => m.ProcessedAt == null && m.RetryCount < 5)
            .OrderBy(m => m.OccurredOn)
            .Take(100)
            .ToListAsync();

        foreach (var msg in messages)
        {
            var @event = JsonSerializer.Deserialize(msg.Payload, _eventTypes[msg.EventType]);
            await _mediator.Publish(@event);        // Phase 1: in-process
            // await _kafkaProducer.ProduceAsync()  // Phase 2: external
            msg.ProcessedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync();
    }
}
```

---

## Domain Event Catalog

### Customer Domain
| Event | Trigger | Downstream Effects |
|---|---|---|
| `CustomerCreated` | New CIF created | Audit log, notification to branch manager |
| `CustomerVerified` | KYC documents accepted | Enables account opening |
| `CustomerFlagged` | AML watchlist hit | Freeze accounts, notify compliance |
| `CustomerAddressChanged` | Address updated | CKYC update trigger, audit |

### Account Domain
| Event | Trigger | Downstream Effects |
|---|---|---|
| `AccountOpened` | New CASA/FD/RD created | GL: create account, notification to customer |
| `AccountDebited` | Withdrawal/charge posted | Balance update, notification, potential NPA check |
| `AccountCredited` | Deposit/credit received | Balance update, interest eligibility recalc |
| `AccountClosed` | Account closed | GL: write-off uncollected, final statement |
| `FdMatured` | FD reaches maturity | Workflow: auto-renewal or credit to CASA |
| `OverdraftLimitExceeded` | OD account overdraws beyond limit | Notification to customer + officer |

### Loan Domain
| Event | Trigger | Downstream Effects |
|---|---|---|
| `LoanApplicationSubmitted` | New loan application | Workflow: maker-checker, credit assessment |
| `LoanSanctioned` | Sanctioned by authority | Notification to customer, document checklist |
| `LoanDisbursed` | Disbursement posted | GL: Dr Loan A/c, Cr Customer A/c; Payment: initiate if external |
| `InstallmentDue` | EMI due date reached | Notification to customer |
| `InstallmentOverdue` | EMI not paid after due date | NPA days counter starts; workflow: recovery |
| `NpaClassified` | 90/180 days overdue | GL: reverse interest income, create provision |
| `LoanClosed` | Final payment received | GL: close GL head, notification, NOC |

### Payment Domain
| Event | Trigger | Downstream Effects |
|---|---|---|
| `PaymentInitiated` | Payment request created | Workflow: maker-checker (if above threshold) |
| `PaymentProcessed` | Successfully sent to NPCI/RBI | Account: debit, GL: posting, Notification |
| `PaymentFailed` | NPCI/RBI rejected | Account: reverse hold, Notification, Audit |
| `PaymentSettled` | Inward credit received | Account: credit, GL: credit posting |
| `ChequeClearanceCompleted` | Cheque cleared | Account: credit (if inward), debit (if outward) |

### EOD Domain
| Event | Trigger | Downstream Effects |
|---|---|---|
| `EodStarted` | EOD trigger at day-end | All services: read-only mode |
| `InterestAccrued` | EOD interest step complete | GL: accrual entries |
| `NpaReviewCompleted` | NPA step complete | RegulatoryService: update NPA report |
| `EodCompleted` | All EOD steps done | All services: resume normal operations |

---

## Event Ordering Guarantee

For financial integrity, **per-account events must be ordered**:
```
Phase 1 (MediatR): handlers run sequentially within a request — ordering guaranteed
Phase 2 (Kafka): use account_id as partition key
  → all events for account ACC001 go to same Kafka partition
  → partition is consumed sequentially
  → ordering guaranteed per account
```

---

## Consequences

### Positive
- Business operations are never blocked by slow downstream services
- New features can subscribe to existing events without modifying publishers
- Outbox pattern guarantees no event loss even on crash
- Event history provides natural audit trail

### Negative / Mitigations
- **Risk:** Event handler failures leave data partially updated
  - **Mitigation:** Retry with exponential backoff; dead-letter queue for manual review
- **Risk:** Eventual consistency means Account and GL may briefly be out of sync
  - **Mitigation:** Account balance (OLTP) is always authoritative; GL is eventually consistent for reporting only
- **Risk:** Large outbox table if processing falls behind
  - **Mitigation:** Monitor outbox depth; alert if > 1000 pending messages

---

## Related Decisions
- ADR-002: Service Decomposition (defines which services publish/consume events)
- ADR-006: Database Strategy (outbox table lives in same PostgreSQL schema as business tables)
- ADR-008: EOD/BOD Engine (EOD lifecycle events coordinate batch steps)

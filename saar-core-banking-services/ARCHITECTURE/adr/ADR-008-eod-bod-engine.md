# ADR-008: EOD/BOD Batch Engine

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-03-29 |
| Deciders | SaaR Architecture Team |
| Regulatory Ref | IDRBT Annexure II — EOD must complete within 3 hours; NPA classification daily |

---

## Context

End-of-Day (EOD) processing is the most critical batch operation in Core Banking. Every night:
- Interest must be accrued on all active CASA accounts
- FD maturity must be checked and processed
- Standing Instructions (SIs) must be executed
- Loan instalments must be checked for overdue
- NPA classification must be reviewed
- GL must be balanced (Trial Balance)
- Day must be formally "closed" and a new working day "opened"
- RBI reports must be generated

IDRBT requires **EOD to complete within 3 hours** (8 PM to 11 PM window typical for UCBs).

A failed EOD mid-way is catastrophic — half the accounts accrued interest, half not. The engine **must be resumable** from the point of failure.

---

## Decision: Step-Based Pipeline with State Persistence

### Architecture

```
EOD Trigger (scheduled via Hangfire at 22:00, or manual by Admin)
    ↓
EOD Controller validates prerequisites:
  - All branches balanced (branch cash verified)
  - No open maker-checker items older than 4 hours
  - No failed transactions pending investigation
    ↓
System enters MAINTENANCE MODE (read-only OLTP)
    ↓
EOD Pipeline executes steps sequentially (state saved after each step)
    ↓
BOD Pipeline runs (next morning, typically 07:00)
    ↓
System exits MAINTENANCE MODE (OLTP resumes)
```

### EOD Pipeline (14 Steps)

```
Step  1: EOD_VALIDATION       — Pre-flight checks (all branches balanced, no stuck txns)
Step  2: PARAM_SNAPSHOT        — Snapshot current parameter values for the day's EOD
Step  3: STANDING_INSTRUCTIONS — Execute all scheduled standing instructions (SIs)
Step  4: CHEQUE_RETURNS        — Post cheque return charges for dishonoured cheques
Step  5: SB_INTEREST_ACCRUAL   — Accrual entries for all savings bank accounts
Step  6: FD_INTEREST_ACCRUAL   — Accrual entries for all fixed deposits
Step  7: LOAN_EMI_SCHEDULE     — Generate next EMI demand notices
Step  8: NPA_CLASSIFICATION    — Classify overdue loans as Sub-Standard/Doubtful/Loss
Step  9: NPA_PROVISIONING      — Create provision entries in GL
Step 10: FD_MATURITY           — Process FDs maturing today (auto-renew or credit CASA)
Step 11: RD_INSTALMENT         — Credit RD instalments due today
Step 12: CHARGES_POSTING       — Post minimum balance, service charges, etc.
Step 13: GL_BALANCING          — Verify Trial Balance (must be zero difference)
Step 14: DAY_CLOSE             — Formally close the accounting date; advance system date
```

### BOD Pipeline (5 Steps)
```
Step  1: PARAM_CACHE_REFRESH   — Reload parameter cache for the new day
Step  2: HOLIDAY_CHECK         — Check if today is a bank holiday; set read-only if so
Step  3: PENDING_CLEARANCE     — Post cheque clearance results from overnight NACH/ECS
Step  4: OUTWARD_REMITTANCES   — Submit pending NEFT/RTGS batches to RBI SFMS
Step  5: BOD_COMPLETE          — System transitions to ONLINE mode; branches can start
```

---

## State Persistence (Resumability)

```sql
CREATE TABLE eod_job_runs (
    id              BIGSERIAL PRIMARY KEY,
    run_date        DATE NOT NULL,
    run_type        TEXT NOT NULL,          -- 'EOD' or 'BOD'
    status          TEXT NOT NULL,          -- RUNNING, COMPLETED, FAILED, PAUSED
    current_step    INT NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    triggered_by    TEXT NOT NULL,
    UNIQUE (run_date, run_type)
);

CREATE TABLE eod_step_results (
    id              BIGSERIAL PRIMARY KEY,
    job_run_id      BIGINT REFERENCES eod_job_runs(id),
    step_number     INT NOT NULL,
    step_name       TEXT NOT NULL,
    status          TEXT NOT NULL,          -- PENDING, RUNNING, COMPLETED, FAILED, SKIPPED
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    records_processed INT,
    error_message   TEXT,
    can_retry       BOOLEAN DEFAULT TRUE,
    UNIQUE (job_run_id, step_number)
);
```

### Resume Logic
```csharp
public async Task RunEodAsync(DateOnly runDate)
{
    var jobRun = await GetOrCreateJobRun(runDate, "EOD");

    if (jobRun.Status == "COMPLETED")
        throw new EodException("EOD already completed for this date");

    for (int step = jobRun.CurrentStep; step < EodSteps.Count; step++)
    {
        var stepDef = EodSteps[step];
        var stepResult = await GetOrCreateStepResult(jobRun.Id, step, stepDef.Name);

        if (stepResult.Status == "COMPLETED")
        {
            _logger.LogInformation("Skipping already-completed step {Step}", stepDef.Name);
            continue;  // Resume: skip completed steps
        }

        _logger.LogInformation("Executing EOD step {Step}: {Name}", step, stepDef.Name);
        stepResult.Status = "RUNNING";
        stepResult.StartedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        try
        {
            var result = await stepDef.ExecuteAsync(runDate, _services);
            stepResult.Status = "COMPLETED";
            stepResult.RecordsProcessed = result.RecordsProcessed;
            jobRun.CurrentStep = step + 1;
            await _db.SaveChangesAsync();

            await _events.Publish(new EodStepCompleted(runDate, stepDef.Name, result));
        }
        catch (Exception ex)
        {
            stepResult.Status = "FAILED";
            stepResult.ErrorMessage = ex.Message;
            jobRun.Status = "FAILED";
            await _db.SaveChangesAsync();

            await _notifications.AlertEodFailure(runDate, stepDef.Name, ex);
            throw;  // Stop pipeline; admin can resume after fixing
        }
    }

    jobRun.Status = "COMPLETED";
    jobRun.CompletedAt = DateTime.UtcNow;
    await _db.SaveChangesAsync();
}
```

---

## Interest Calculation Detail (Step 5/6)

Interest calculation is the most compute-intensive step — 10,000–100,000 accounts, each requiring:
1. Fetch daily minimum balance for the month
2. Apply tiered interest rate from parameter engine
3. Create accrual journal entry
4. Accumulate for quarterly credit to customer

```csharp
public async Task<StepResult> ExecuteSbInterestAccrualAsync(DateOnly accrualDate)
{
    int processed = 0;
    const int batchSize = 500;

    // Process in batches to avoid memory exhaustion
    await foreach (var batch in _db.Accounts
        .Where(a => a.AccountType == "SB" && a.Status == "ACTIVE")
        .AsAsyncEnumerable()
        .Batch(batchSize))
    {
        foreach (var account in batch)
        {
            var dailyMinBalance = await GetDailyMinBalance(account.Id, accrualDate);
            var rate = await _params.GetDecimalAsync("sb.interest_rate", accrualDate);
            var seniorBonus = account.Customer.IsSeniorCitizen
                ? await _params.GetDecimalAsync("sb.interest_rate.senior_citizen_bonus", accrualDate)
                : 0m;

            var dailyInterest = dailyMinBalance * (rate + seniorBonus) / 100 / 365;

            if (dailyInterest > 0)
            {
                await _gl.PostAccrualEntryAsync(account, dailyInterest, accrualDate);
            }
        }
        processed += batch.Count;
        _logger.LogInformation("SB Interest: processed {Count} accounts", processed);
    }

    return new StepResult { RecordsProcessed = processed };
}
```

---

## NPA Classification (Step 8)

```csharp
public async Task<StepResult> ExecuteNpaClassificationAsync(DateOnly runDate)
{
    var overdueLoans = await _db.Loans
        .Where(l => l.Status == "ACTIVE" && l.NextDueDate < runDate)
        .ToListAsync();

    foreach (var loan in overdueLoans)
    {
        var daysPastDue = (runDate - loan.NextDueDate).Days;
        var npaThreshold = loan.LoanType == "AGRICULTURAL"
            ? await _params.GetIntAsync("npa.agricultural.overdue_days", runDate)
            : await _params.GetIntAsync("npa.term_loan.overdue_days", runDate);

        NpaCategory newCategory;
        if (daysPastDue >= npaThreshold + 365)      newCategory = NpaCategory.Loss;
        else if (daysPastDue >= npaThreshold + 180)  newCategory = NpaCategory.Doubtful;
        else if (daysPastDue >= npaThreshold)         newCategory = NpaCategory.SubStandard;
        else                                          newCategory = NpaCategory.Standard;

        if (newCategory != loan.NpaCategory)
        {
            loan.NpaCategory = newCategory;
            loan.NpaClassifiedDate = runDate;
            await _auditService.LogNpaChange(loan, newCategory, runDate);

            if (newCategory != NpaCategory.Standard)
            {
                // Reverse uncollected interest income (RBI IRAC norms)
                await _gl.ReverseInterestIncomeAsync(loan, runDate);
                // Create provision entry
                await _gl.CreateProvisionEntryAsync(loan, newCategory, runDate);
            }
        }
    }

    return new StepResult { RecordsProcessed = overdueLoans.Count };
}
```

---

## Monitoring and Alerting

```
EOD Dashboard (Grafana):
  - Current step progress bar
  - Records processed per step
  - Time elapsed vs expected duration
  - Alert if EOD not started by 22:30
  - Alert if any step takes > 45 minutes
  - Alert if EOD not completed by 01:00

Admin Notification (SMS + app):
  - EOD started
  - Each step completion
  - Any step failure (with error details)
  - EOD completed (with total duration)
```

---

## Consequences

### Positive
- EOD failure is recoverable — resume from last successful step (no need to re-run from scratch)
- Step results provide complete audit trail for EOD execution
- Parameter snapshot at start of EOD prevents mid-EOD parameter changes affecting results
- Batch processing with configurable batch size prevents memory exhaustion on large banks

### Negative / Mitigations
- **Risk:** EOD runs over 3-hour window
  - **Mitigation:** Monitor step timings; optimize slowest steps (usually NPA classification and SI execution)
- **Risk:** GL Balancing step fails (Step 13) — indicates a posting error during EOD
  - **Mitigation:** Detailed GL exception report; manual correction workflow before re-run
- **Risk:** Standing Instructions execute after customer's account is already in maintenance mode
  - **Mitigation:** SI execution (Step 3) is first in pipeline; accounts are available at that point

---

## Related Decisions
- ADR-004: Event Architecture (EOD lifecycle events published at each step)
- ADR-005: Parametrization (parameter snapshot taken at EOD start)
- ADR-009: Reporting Architecture (RBI reports generated post-EOD)
- ADR-006: Database Strategy (EOD uses Replica 2 for reads to avoid OLTP impact)

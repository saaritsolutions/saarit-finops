# ADR-005: Parametrization Engine Design

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-03-29 |
| Deciders | SaaR Architecture Team |
| Regulatory Ref | IDRBT Section 1 (Product Parametrization), Section 3 (Interest Rates), IDRBT Annexure II — Parameterized products |

---

## Context

A Core Banking platform must serve multiple banks, each with different:
- Interest rates (e.g., SB: 3.5% vs 4.0%, FD rates by tenure, differential rates for senior citizens)
- Charges (cheque book charges, service charges, minimum balance penalties)
- Products (Bank A offers recurring deposit; Bank B does not)
- Regulatory limits (loan-to-value ratios, NPA days definition for agriculture)
- Workflow rules (approval thresholds: Bank A requires Manager for >1L; Bank B for >5L)

**Architecture Principle P1:** Every bank-specific variation is a **parameter**, not a code branch.

This means we must never write code like:
```csharp
// WRONG — hard-coded business rules
if (bank == "KL001UCB")
    interestRate = 3.5m;
else
    interestRate = 4.0m;
```

Instead all such values must come from a parameter store with:
- Effective date support (rate changes take effect on a specific date)
- Approval workflow (rate changes require maker-checker)
- Audit trail (who changed what rate, when, why)
- Cache (parameters are read thousands of times per EOD)

---

## Decision Options Considered

### Option A: Configuration Files (appsettings.json per bank)
```
Pros: Simple, version-controlled
Cons:
  - Cannot change without code deployment
  - No effective date support
  - No maker-checker workflow
  - Cannot be changed by bank staff (requires IT)
Rejected: Fails IDRBT requirement for bank-configurable parameters
```

### Option B: Single flat table (bank_id + key + value)
```
CREATE TABLE parameters (
    bank_id TEXT, key TEXT, value TEXT,
    PRIMARY KEY (bank_id, key)
);
Pros: Simple
Cons:
  - No effective date support (SB rate changes on April 1)
  - No parameter hierarchy (system-level defaults vs bank overrides)
  - No type safety (all values are TEXT)
  - No audit trail
Rejected: Too simple for production CBS
```

### Option C: 3-tier hierarchical parameter store ✓ CHOSEN
```
Tier 1: System Parameters (SaaR-managed, all banks)
  e.g., max_loan_tenure = 360 months (regulatory ceiling)
  e.g., npci_rtgs_cutoff_time = 17:30

Tier 2: Bank Parameters (bank-configured, per bank)
  e.g., sb_interest_rate = 3.5%
  e.g., minimum_balance_savings = 1000
  e.g., maker_checker_threshold = 100000

Tier 3: Product Parameters (per product, per bank)
  e.g., fd_rate_12months = 7.25%
  e.g., fd_rate_senior_citizen_bonus = 0.50%
  e.g., loan_processing_fee_personal = 1.0%
```

---

## Decision: 3-Tier Parametrization with Effective Dates

### Database Schema

```sql
-- Tier 1: System-level parameters (SaaR managed)
CREATE TABLE saar_system.system_parameters (
    param_key       TEXT PRIMARY KEY,
    param_value     TEXT NOT NULL,
    data_type       TEXT NOT NULL,  -- 'decimal', 'integer', 'text', 'boolean', 'time'
    description     TEXT,
    last_updated_by TEXT,
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tier 2: Bank-level parameters (bank configured, with effective date + audit)
CREATE TABLE bank_parameters (
    id              BIGSERIAL PRIMARY KEY,
    param_key       TEXT NOT NULL,
    param_value     TEXT NOT NULL,
    data_type       TEXT NOT NULL,
    effective_from  DATE NOT NULL,
    effective_to    DATE,           -- NULL = open-ended (current)
    is_active       BOOLEAN DEFAULT TRUE,
    -- Maker-checker
    created_by      TEXT NOT NULL,
    approved_by     TEXT,
    approved_at     TIMESTAMPTZ,
    status          TEXT DEFAULT 'PENDING_APPROVAL',  -- PENDING_APPROVAL, APPROVED, REJECTED
    rejection_reason TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (param_key, effective_from)
);

-- Tier 3: Product-level parameters
CREATE TABLE product_parameters (
    id              BIGSERIAL PRIMARY KEY,
    product_code    TEXT NOT NULL,  -- e.g., 'FD_REGULAR', 'SB_BASIC'
    param_key       TEXT NOT NULL,
    param_value     TEXT NOT NULL,
    data_type       TEXT NOT NULL,
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      TEXT NOT NULL,
    approved_by     TEXT,
    status          TEXT DEFAULT 'PENDING_APPROVAL',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (product_code, param_key, effective_from)
);
```

### Resolution Hierarchy
```
Get interest rate for product "FD_1YEAR":
1. Look up Tier 3: product_parameters WHERE product_code='FD_1YEAR' AND param_key='interest_rate'
   → If found and approved and effective: use this value
2. Fall back to Tier 2: bank_parameters WHERE param_key='default_fd_rate'
   → If found: use this value
3. Fall back to Tier 1: system_parameters WHERE param_key='default_fd_rate'
4. If not found: throw ParameterNotFoundException (never silently default)
```

### Effective Date Resolution
```csharp
public decimal GetRate(string paramKey, DateOnly effectiveDate)
{
    // Get the parameter value that was active on the given date
    var param = _db.BankParameters
        .Where(p => p.ParamKey == paramKey
                 && p.Status == "APPROVED"
                 && p.EffectiveFrom <= effectiveDate
                 && (p.EffectiveTo == null || p.EffectiveTo >= effectiveDate))
        .OrderByDescending(p => p.EffectiveFrom)
        .FirstOrDefault();

    return param != null
        ? decimal.Parse(param.ParamValue)
        : _systemParams.GetDecimal(paramKey); // fall back to system default
}
```

### Parameter Change Workflow
```
Bank Admin creates parameter change (e.g., SB rate 3.5% → 4.0% effective April 1)
    ↓
Status: PENDING_APPROVAL
    ↓
Bank Manager (Checker) reviews and approves
    ↓
Status: APPROVED
    ↓
On April 1, EOD job refreshes parameter cache
    ↓
New rate takes effect for all April 1 interest calculations
```

### Parameter Cache (Redis)
```csharp
// Cache key: params:{bankId}:{paramKey}:{effectiveDate}
// TTL: 1 hour (refreshed at BOD/EOD)
public async Task<decimal> GetDecimalAsync(string paramKey, DateOnly date)
{
    var cacheKey = $"params:{_tenantId}:{paramKey}:{date:yyyyMMdd}";
    var cached = await _cache.GetStringAsync(cacheKey);
    if (cached != null)
        return decimal.Parse(cached);

    var value = await GetFromDatabase(paramKey, date);
    await _cache.SetStringAsync(cacheKey, value.ToString(),
        new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1) });
    return value;
}
```

---

## Standard Parameter Catalogue

### Interest Rate Parameters
| Parameter Key | Description | Example Value |
|---|---|---|
| `sb.interest_rate` | Savings Bank interest rate | 3.50 |
| `sb.interest_rate.senior_citizen_bonus` | Additional rate for senior citizens | 0.50 |
| `fd.min_tenure_days` | Minimum FD tenure | 7 |
| `fd.max_tenure_months` | Maximum FD tenure | 120 |
| `od.penal_rate_above_limit` | Penal interest for OD beyond limit | 2.00 |
| `npa.term_loan.overdue_days` | Days overdue for NPA classification | 90 |
| `npa.agricultural.overdue_days` | Days for agricultural loan NPA | 180 |

### Charge Parameters
| Parameter Key | Description | Example Value |
|---|---|---|
| `charge.chequebook.10leaves` | Cheque book charge (10 leaves) | 50.00 |
| `charge.atm.own_bank` | ATM charge own bank | 0.00 |
| `charge.atm.other_bank` | ATM charge other bank (beyond free limit) | 20.00 |
| `charge.min_balance.savings.urban` | Minimum balance savings urban | 1000 |
| `charge.min_balance.penalty_pct` | Penalty as % of shortfall | 5.00 |
| `charge.rtgs.inward` | RTGS inward charge | 0.00 |
| `charge.rtgs.outward.2to5lakh` | RTGS outward charge (2–5 lakh) | 25.00 |

### Operational Parameters
| Parameter Key | Description | Example Value |
|---|---|---|
| `workflow.maker_checker_threshold` | Amount above which maker-checker required | 100000 |
| `eod.interest_credit_day` | Day of month SB interest is credited | 31 |
| `eod.start_time` | EOD trigger time | 22:00 |
| `session.inactivity_timeout_minutes` | Auto-logout on inactivity | 3 |
| `loan.max_ltv.home_loan` | Maximum Loan-to-Value for home loan | 80.00 |

---

## Consequences

### Positive
- Banks can modify rates/charges without code deployment
- Effective date support enables pre-scheduled rate changes
- Maker-checker on parameter changes satisfies IDRBT compliance
- Cache ensures parameter reads don't slow down EOD (50,000+ lookups)

### Negative / Mitigations
- **Risk:** Incorrect parameter value causes wrong interest calculation for EOD
  - **Mitigation:** Parameter change workflow requires authorizer approval; EOD runs a pre-flight parameter validation step
- **Risk:** Cache stale after parameter approval
  - **Mitigation:** Cache invalidated on approval; BOD job refreshes all parameter caches
- **Risk:** Parameter hierarchy resolution is complex to debug
  - **Mitigation:** Admin API endpoint shows effective value + which tier it came from

---

## Related Decisions
- ADR-001: Multi-Tenancy (parameters are schema-scoped per tenant)
- ADR-007: Security (parameter changes require RBAC role `PARAM_ADMIN`)
- ADR-008: EOD/BOD (BOD step 1: refresh parameter caches)

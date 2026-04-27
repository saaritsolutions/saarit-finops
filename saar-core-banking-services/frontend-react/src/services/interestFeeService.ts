/**
 * interestFeeService.ts — API client for InterestFeeService (SAAR-IFS-001)
 *
 * Endpoints:
 *   InterestFeeService: /api/interest-fees/*
 */

const IFS_BASE = process.env.REACT_APP_API_BASE_URL
  ? ''   // Production: relative path via nginx
  : 'http://localhost:5218';  // Local dev

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AccrualSummaryDay {
  date:          string;
  tenantId:      string;
  totalInterest: number;
  accountCount:  number;
}

export interface MonthlyPostingResult {
  period:            string;
  tenantsProcessed:  number;
  accountsPosted:    number;
  totalInterest:     number;
  totalTds:          number;
}

export interface AccountInterestTds {
  accruedInterest: number;
  accruedTds:      number;
  balance:         number;
  isTDSExempt:     boolean;
}

// ── API Calls ─────────────────────────────────────────────────────────────────

export async function getAccrualSummary(
  tenantId?: string,
  from?: string,
  to?: string,
): Promise<AccrualSummaryDay[]> {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenantId', tenantId);
  if (from)     params.set('from', from);
  if (to)       params.set('to', to);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${IFS_BASE}/api/interest-fees/accrual-summary${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`accrual-summary: ${res.status}`);
  return res.json();
}

export async function runDailyAccrual(): Promise<{ message: string; date: string }> {
  const res = await fetch(`${IFS_BASE}/api/interest-fees/run-daily-accrual`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`run-daily-accrual: ${res.status}`);
  return res.json();
}

export async function runMonthlyPosting(period: string): Promise<MonthlyPostingResult> {
  const res = await fetch(
    `${IFS_BASE}/api/interest-fees/run-monthly-posting?period=${period}`,
    { method: 'POST', headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`run-monthly-posting: ${res.status}`);
  return res.json();
}

export async function getAccountInterestTds(accountId: number): Promise<AccountInterestTds> {
  const res = await fetch(`${IFS_BASE}/api/interest-fees/${accountId}/interest-tds`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`interest-tds: ${res.status}`);
  return res.json();
}

/**
 * reportService.ts — API client for the MIS Reports & Compliance Dashboard (SAAR-RPT-001)
 *
 * Endpoints:
 *   TransactionService: /api/journal/daily-summary, /api/ledger/balances,
 *                       /api/compliance/alerts, PATCH /api/compliance/alerts/{id}
 *   AccountService:     /api/account/upcoming-maturities
 */

const TXN_BASE = process.env.REACT_APP_TRANSACTION_BASE_URL || 'http://localhost:5005';
const ACC_BASE = process.env.REACT_APP_ACCOUNT_BASE_URL    || 'http://localhost:5217';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'auth-token': token } : {}),
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailySummaryDay {
  date:         string;
  journalCount: number;
  totalDebit:   number;
  totalCredit:  number;
}

export interface DailySummaryReport {
  from:             string;
  to:               string;
  days:             DailySummaryDay[];
  grandTotalCount:  number;
  grandTotalDebit:  number;
  grandTotalCredit: number;
}

export interface LedgerBalanceRecord {
  accountCode:   string;
  accountName?:  string;
  debitTotal:    number;
  creditTotal:   number;
  normalBalance: string;
  lastUpdatedAt: string;
}

export interface ComplianceAlert {
  id:            string;
  alertType:     string;
  journalNumber: string;
  referenceId:   string;
  triggerAmount: number;
  status:        string;
  reviewedBy?:   string;
  reviewedAt?:   string;
  reviewNotes?:  string;
  createdAt:     string;
}

export interface ComplianceAlertsResponse {
  total:    number;
  page:     number;
  pageSize: number;
  items:    ComplianceAlert[];
}

export interface UpcomingMaturity {
  accountId:         string;
  accountNumber:     string;
  customerId:        string;
  productType:       string;
  principal:         number;
  annualRate:        number;
  termMonths:        number;
  maturityDate:      string;
  daysToMaturity:    number;
  projectedInterest: number;
  projectedPayout:   number;
  autoRenewal:       boolean;
}

// ── API Functions ─────────────────────────────────────────────────────────────

/** Daily transaction volume grouped by date. */
export async function getDailySummary(from: string, to: string): Promise<DailySummaryReport> {
  const res = await fetch(
    `${TXN_BASE}/api/journal/daily-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`daily-summary ${res.status}`);
  return res.json();
}

/** All GL account running balances. */
export async function getLedgerBalances(): Promise<LedgerBalanceRecord[]> {
  const res = await fetch(`${TXN_BASE}/api/ledger/balances`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`ledger/balances ${res.status}`);
  return res.json();
}

/** Paginated compliance alerts, optionally filtered by status / alertType. */
export async function getComplianceAlerts(
  status?: string,
  alertType?: string,
  page    = 1,
  pageSize = 20,
): Promise<ComplianceAlertsResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status)    params.set('status',    status);
  if (alertType) params.set('alertType', alertType);
  const res = await fetch(
    `${TXN_BASE}/api/compliance/alerts?${params}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`compliance/alerts ${res.status}`);
  return res.json();
}

/** Mark a compliance alert as FILED or DISMISSED. */
export async function reviewComplianceAlert(
  id:      string,
  action:  'FILED' | 'DISMISSED',
  notes?:  string,
  reviewedBy?: string,
): Promise<ComplianceAlert> {
  const res = await fetch(`${TXN_BASE}/api/compliance/alerts/${id}`, {
    method:  'PATCH',
    headers: authHeaders(),
    body:    JSON.stringify({ action, notes, reviewedBy }),
  });
  if (!res.ok) throw new Error(`review alert ${res.status}`);
  return res.json();
}

/** FD/RD accounts maturing within the given number of days. */
export async function getUpcomingMaturities(days = 30): Promise<UpcomingMaturity[]> {
  const res = await fetch(
    `${ACC_BASE}/api/account/upcoming-maturities?days=${days}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`upcoming-maturities ${res.status}`);
  return res.json();
}

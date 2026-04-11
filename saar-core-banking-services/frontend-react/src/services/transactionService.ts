import { apiService } from './apiService';

const JOURNAL_BASE = '/api/journal';
const LEDGER_BASE  = '/api/ledger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JournalEntry {
  journalEntryId: number;
  journalId: number;
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  currency: string;
  narration?: string;
  entryDate: string;
}

export interface Journal {
  journalId: number;
  journalNumber: string;
  idempotencyKey: string;
  description: string;
  referenceType: string;
  referenceId?: string;
  postedBy: string;
  postedAt: string;
  status: string; // Posted | Reversed
  entries: JournalEntry[];
}

export interface LedgerBalance {
  accountCode: string;
  accountName: string;
  normalBalance: string; // Debit | Credit
  debitTotal: number;
  creditTotal: number;
  balance: number;
  lastUpdatedAt?: string;
}

export interface PostEntryRequest {
  accountCode: string;
  debitAmount: number;
  creditAmount: number;
  currency?: string;
  narration?: string;
}

export interface PostJournalRequest {
  idempotencyKey: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  postedBy?: string;
  entries: PostEntryRequest[];
}

// ── Service ───────────────────────────────────────────────────────────────────

export const transactionService = {
  /** GET /api/journal — list recent journals, newest first */
  listJournals: (page = 1, pageSize = 20) =>
    apiService.get<Journal[]>(`${JOURNAL_BASE}?page=${page}&pageSize=${pageSize}`),

  /** GET /api/journal/{id} */
  getJournal: (id: number) => apiService.get<Journal>(`${JOURNAL_BASE}/${id}`),

  /** GET /api/journal/by-number/{number} — look up by JournalNumber string (e.g. JNL-20260407-000001) */
  getJournalByNumber: (journalNumber: string) =>
    apiService.get<Journal>(`${JOURNAL_BASE}/by-number/${encodeURIComponent(journalNumber)}`),

  /** POST /api/journal — post a new double-entry journal */
  postJournal: (data: PostJournalRequest) => apiService.post<Journal>(JOURNAL_BASE, data),

  /** GET /api/ledger/balances — all GL account balances */
  getLedgerBalances: () => apiService.get<LedgerBalance[]>(`${LEDGER_BASE}/balances`),

  /** GET /api/ledger/balance/{code} — single account balance */
  getBalance: (accountCode: string) =>
    apiService.get<LedgerBalance>(`${LEDGER_BASE}/balance/${accountCode}`),
};

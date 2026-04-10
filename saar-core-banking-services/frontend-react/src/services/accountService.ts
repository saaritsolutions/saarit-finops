import { apiService } from './apiService';

const BASE = '/api/account';

export interface AccountRecord {
  accountId: number;
  accountNumber?: string;
  customerId: number;
  productTypeId?: number;
  productType?: { accountProductTypeId: number; name: string };
  balance: number;
  status?: string;          // Active | Frozen | Closed | Dormant | Mature
  dateOpened?: string;
  dateClosed?: string;
  modeOfOperation?: string; // SingleOperator | JointOperator | JointOperatorEither | Guardian
  approvalStatus?: string;  // Pending | Approved | Rejected
  createdBy?: string;
  approvedBy?: string;
  createdAt?: string;
  approvedAt?: string;
  isMinor?: boolean;
  isBSBD?: boolean;
  isSimplifiedKYC?: boolean;
  branchId?: number;
  // FD/RD-specific fields
  maturityDate?: string;
  termMonths?: number;
  annualRate?: number;
  autoRenewal?: boolean;
  maturityJournalNumber?: string;
}

export interface MaturityRecord {
  accountId: number;
  accountNumber?: string;
  customerId: number;
  productType?: string;
  balance: number;
  maturityDate?: string;
  termMonths?: number;
  annualRate?: number;
  autoRenewal?: boolean;
  projectedInterest?: number;
  projectedMaturityAmount?: number;
}

export interface MatureResult {
  success: boolean;
  journalNumber?: string;
  renewedMaturityDate?: string;
  message?: string;
}

export interface PrematureCloseResult {
  success: boolean;
  journalNumber?: string;
  penaltyAmount?: number;
  netPayout?: number;
  message?: string;
}

export interface CreateAccountDto {
  accountNumber?: string;
  customerId: number;
  productTypeId?: number;
  balance?: number;
  modeOfOperation?: string;
  isMinor?: boolean;
  legalGuardianName?: string;
  branchId?: number;
}

export const accountService = {
  list: () => apiService.get<AccountRecord[]>(BASE),

  get: (id: number) => apiService.get<AccountRecord>(`${BASE}/${id}`),

  create: (data: CreateAccountDto) => apiService.post<AccountRecord>(BASE, data),

  update: (id: number, data: CreateAccountDto & { accountId: number }) =>
    apiService.put<void>(`${BASE}/${id}`, data),

  remove: (id: number) => apiService.delete<void>(`${BASE}/${id}`),

  approve: (id: number) => apiService.post<void>(`${BASE}/${id}/approve`, {}),

  close: (id: number) => apiService.post<void>(`${BASE}/${id}/close`, {}),

  // FD/RD lifecycle
  mature: (id: number) => apiService.post<MatureResult>(`${BASE}/${id}/mature`, {}),

  prematureClose: (id: number) => apiService.post<PrematureCloseResult>(`${BASE}/${id}/premature-close`, {}),

  upcomingMaturities: (days = 30) =>
    apiService.get<MaturityRecord[]>(`${BASE}/upcoming-maturities?days=${days}`),

  freeze: (id: number) => apiService.post<{ accountId: number; accountNumber?: string; status: string }>(`${BASE}/${id}/freeze`, {}),

  unfreeze: (id: number) => apiService.post<{ accountId: number; accountNumber?: string; status: string }>(`${BASE}/${id}/unfreeze`, {}),
};

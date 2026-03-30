import { apiService } from './apiService';

const BASE = '/api/account';

export interface AccountRecord {
  accountId: number;
  accountNumber?: string;
  customerId: number;
  productTypeId?: number;
  productType?: { accountProductTypeId: number; name: string };
  balance: number;
  status?: string;          // Active | Frozen | Closed | Dormant
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
};

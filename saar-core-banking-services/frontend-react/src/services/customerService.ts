import { apiService } from './apiService';

const BASE = '/api/customer';

export interface CustomerRecord {
  customerId: number;
  salutation?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fatherOrHusbandName?: string;
  postalAddress?: string;
  telephone?: string;
  mobile?: string;
  email?: string;
  dateOfBirth: string; // ISO date string
  gender?: string;
  pan?: string;
  uid?: string;        // Aadhaar
  customerType?: string;
  kycStatus: number;   // 0=NotStarted 1=InProgress 2=Submitted 3=Verified 4=Rejected 5=Expired
  approvalStatus?: string;
  createdAt: string;
}

export interface CreateCustomerDto {
  salutation?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fatherOrHusbandName?: string;
  postalAddress?: string;
  telephone?: string;
  mobile?: string;
  email?: string;
  dateOfBirth: string;
  gender?: string;
  pan?: string;
  uid?: string;
  customerType?: string;
}

export interface ValidationResult {
  isValid: boolean;
  message: string;
}

export interface KycActionResult {
  kycStatus: number;
  message: string;
}

export const KYC_STATUS_LABELS: Record<number, string> = {
  0: 'Not Started',
  1: 'In Progress',
  2: 'Docs Submitted',
  3: 'Verified',
  4: 'Rejected',
  5: 'Expired',
};

export const customerService = {
  list: () => apiService.get<CustomerRecord[]>(BASE),

  get: (id: number) => apiService.get<CustomerRecord>(`${BASE}/${id}`),

  create: (data: CreateCustomerDto) => apiService.post<CustomerRecord>(BASE, data),

  update: (id: number, data: CreateCustomerDto & { customerId: number }) =>
    apiService.put<void>(`${BASE}/${id}`, data),

  remove: (id: number) => apiService.delete<void>(`${BASE}/${id}`),

  validatePan: (value: string) =>
    apiService.post<ValidationResult>(`${BASE}/validate/pan`, { value }),

  validateAadhaar: (value: string) =>
    apiService.post<ValidationResult>(`${BASE}/validate/aadhaar`, { value }),

  // ── KYC Workflow ────────────────────────────────────────────────────────
  initiateKyc: (id: number) =>
    apiService.post<KycActionResult>(`${BASE}/${id}/kyc/initiate`, {}),

  submitKycDocuments: (id: number) =>
    apiService.post<KycActionResult>(`${BASE}/${id}/kyc/submit-documents`, {}),

  verifyKyc: (id: number, verifiedBy: string) =>
    apiService.post<KycActionResult>(`${BASE}/${id}/kyc/verify`, { verifiedBy }),

  rejectKyc: (id: number, rejectionReason: string) =>
    apiService.post<KycActionResult>(`${BASE}/${id}/kyc/reject`, { rejectionReason }),
};

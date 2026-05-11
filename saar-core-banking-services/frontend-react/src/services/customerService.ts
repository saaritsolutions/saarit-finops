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

export interface CustomerListResponse {
  total: number;
  items: CustomerRecord[];
  page: number;
  pageSize: number;
}

export interface CustomerListParams {
  search?: string;
  kycStatus?: string;
  customerType?: string;
  page?: number;
  pageSize?: number;
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
  list: (params?: CustomerListParams) => {
    const qs = new URLSearchParams();
    if (params?.search)       qs.set('search', params.search);
    if (params?.kycStatus)    qs.set('kycStatus', params.kycStatus);
    if (params?.customerType) qs.set('customerType', params.customerType);
    if (params?.page)         qs.set('page', String(params.page));
    if (params?.pageSize)     qs.set('pageSize', String(params.pageSize));
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiService.get<CustomerListResponse>(`${BASE}${suffix}`);
  },

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

  expireKyc: (id: number) =>
    apiService.post<KycActionResult>(`${BASE}/${id}/kyc/expire`, {}),

  // ── Document Upload ─────────────────────────────────────────────────────
  uploadDocument: async (id: number, docType: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', docType);
    // Don't set Content-Type header; let axios/browser handle multipart/form-data boundary
    return apiService.post<{ message: string }>(
      `${BASE}/${id}/documents/upload`,
      formData
    );
  },

  markKycIncomplete: (id: number) =>
    apiService.post<KycActionResult>(`${BASE}/${id}/kyc/mark-incomplete`, {}),
};

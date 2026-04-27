import axios from 'axios';

const BASE_URL = process.env.REACT_APP_LOAN_SERVICE_BASE_URL || 'http://localhost:5130';
const API_ROOT       = `${BASE_URL}/api/LoanOrigination`;
const PRODUCTS_ROOT  = `${BASE_URL}/api/loan-products`;
const LOANS_ROOT     = `${BASE_URL}/api/loans`;

const norm = (d: any, ...keys: string[]) => {
  for (const k of keys) {
    const lo = k[0].toLowerCase() + k.slice(1);
    const up = k[0].toUpperCase() + k.slice(1);
    if (d[lo] !== undefined) return d[lo];
    if (d[up] !== undefined) return d[up];
  }
  return undefined;
};

// ── Loan Products ─────────────────────────────────────────────────────────────
export interface LoanProduct {
  id: string;
  productCode: string;
  name: string;
  description?: string;
  category: string;          // SECURED | UNSECURED
  minAmount: number;
  maxAmount: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  baseRatePercent: number;
  maxRatePercent: number;
  processingFeePercent: number;
  minCibilScore: number;
  minMonthlyIncome: number;
  maxFoirPercent: number;
  maxLtvPercent: number;
  requiresCollateral: boolean;
  allowsCoApplicant: boolean;
}

export interface DocumentChecklistItem {
  documentType: string;
  documentLabel: string;
  isMandatory: boolean;
  acceptedFormats: string[];
}

export interface DocumentChecklist {
  productCode: string;
  productName: string;
  items: DocumentChecklistItem[];
}

export async function getLoanProducts(): Promise<LoanProduct[]> {
  const res = await axios.get(PRODUCTS_ROOT);
  return res.data as LoanProduct[];
}

export async function getDocumentChecklist(productCode: string): Promise<DocumentChecklist> {
  const res = await axios.get(`${PRODUCTS_ROOT}/${productCode}/checklist`);
  return res.data as DocumentChecklist;
}

// ── Eligibility ───────────────────────────────────────────────────────────────
export interface EligibilityRequest {
  productType: string;
  requestedAmount: number;
  tenureMonths: number;
  grossMonthlyIncome: number;
  existingMonthlyEMI: number;
  proposedMonthlyEMI: number;
  cibilScore: number;
  collateralValue: number;
}

export interface EligibilityResult {
  isEligible: boolean;
  maxEligibleAmount: number;
  recommendedRatePercent: number;
  foirPercent: number;
  ltvPercent?: number;
  proposedMonthlyEMI: number;
  processingFee: number;
  cibilBand: string;
  rejectionReasons: string[];
}

export async function checkEligibility(req: EligibilityRequest): Promise<EligibilityResult> {
  const res = await axios.post(`${LOANS_ROOT}/check-eligibility`, req);
  const d = res.data;
  return {
    isEligible:             norm(d, 'IsEligible', 'isEligible') ?? false,
    maxEligibleAmount:      norm(d, 'MaxEligibleAmount', 'maxEligibleAmount') ?? 0,
    recommendedRatePercent: norm(d, 'RecommendedRatePercent', 'recommendedRatePercent') ?? 0,
    foirPercent:            norm(d, 'FOIRPercent', 'foirPercent', 'fOIRPercent') ?? 0,
    ltvPercent:             norm(d, 'LTVPercent', 'ltvPercent', 'lTVPercent'),
    proposedMonthlyEMI:     norm(d, 'ProposedMonthlyEMI', 'proposedMonthlyEMI') ?? 0,
    processingFee:          norm(d, 'ProcessingFee', 'processingFee') ?? 0,
    cibilBand:              norm(d, 'CibilBand', 'cibilBand') ?? '',
    rejectionReasons:       norm(d, 'RejectionReasons', 'rejectionReasons') ?? [],
  };
}

// ── EMI Calculator ────────────────────────────────────────────────────────────
export interface EmiResult {
  monthlyEMI: number;
  totalPayment: number;
  totalInterest: number;
  principal: number;
  annualRate: number;
  tenureMonths: number;
}

export async function calculateEMI(
  principal: number,
  tenureMonths: number,
  annualRatePercent: number,
): Promise<EmiResult> {
  const res = await axios.get(`${LOANS_ROOT}/calculate-emi`, {
    params: { principal, tenureMonths, annualRatePercent },
  });
  const d = res.data;
  return {
    monthlyEMI:    norm(d, 'MonthlyEMI', 'monthlyEMI') ?? 0,
    totalPayment:  norm(d, 'TotalPayment', 'totalPayment') ?? 0,
    totalInterest: norm(d, 'TotalInterest', 'totalInterest') ?? 0,
    principal:     norm(d, 'Principal', 'principal') ?? 0,
    annualRate:    norm(d, 'AnnualRate', 'annualRate') ?? 0,
    tenureMonths:  norm(d, 'TenureMonths', 'tenureMonths') ?? 0,
  };
}

// ── Full Loan Application Submit ──────────────────────────────────────────────
export interface FullLoanApplicationRequest {
  // Step 1
  applicantName: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  panNumber: string;
  aadhaarLast4: string;
  mobileNumber: string;
  email: string;
  currentAddressLine1: string;
  currentAddressLine2?: string;
  currentCity: string;
  currentState: string;
  currentPinCode: string;
  residenceType: string;
  sameAsCurrent: boolean;
  permanentAddressLine1?: string;
  permanentAddressLine2?: string;
  permanentCity?: string;
  permanentState?: string;
  permanentPinCode?: string;
  // Step 2
  employmentType: string;
  employerName: string;
  designation: string;
  yearsAtCurrentJob: number;
  grossMonthlyIncome: number;
  netMonthlyIncome: number;
  otherMonthlyIncome: number;
  existingMonthlyEMI: number;
  monthlyObligations: number;
  cibilScore: number;
  // Step 3
  productType: string;
  requestedAmount: number;
  tenureMonths: number;
  purposeOfLoan: string;
  collateralType?: string;
  collateralValue?: number;
  collateralDescription?: string;
  // Step 4
  hasCoApplicant: boolean;
  coApplicantJson?: string;
  // Misc
  loanAmount?: number; // backward compat
  creditScore?: number;
  monthlyIncome?: number;
  debtToIncomeRatio?: number;
  customerId?: string;
}

export interface SubmitApplicationResponse {
  status: string;
  applicationId?: string;
  applicationNumber?: string;
  workflowInstanceId?: string;
  currentStep?: string;
  interestRate?: number;
  message?: string;
}

export async function submitFullApplication(payload: FullLoanApplicationRequest): Promise<SubmitApplicationResponse> {
  // Map to the legacy submit endpoint (backward compat)
  const legacyPayload = {
    customerId: payload.applicantName,
    loanAmount: payload.requestedAmount,
    tenureMonths: payload.tenureMonths,
    creditScore: payload.cibilScore,
    monthlyIncome: payload.grossMonthlyIncome,
    debtToIncomeRatio: payload.existingMonthlyEMI / Math.max(payload.grossMonthlyIncome, 1),
    productType: payload.productType,
    // Extended fields sent as extras
    formDataJson: JSON.stringify(payload),
  };
  const res = await axios.post(`${API_ROOT}/submit`, legacyPayload);
  const d = res.data;
  return {
    status:              norm(d, 'Status', 'status') ?? '',
    applicationId:       norm(d, 'ApplicationId', 'applicationId'),
    applicationNumber:   norm(d, 'ApplicationNumber', 'applicationNumber'),
    workflowInstanceId:  norm(d, 'WorkflowInstanceId', 'workflowInstanceId'),
    currentStep:         norm(d, 'CurrentStep', 'currentStep'),
    interestRate:        norm(d, 'InterestRate', 'interestRate'),
    message:             norm(d, 'Message', 'message'),
  };
}

// ── Loan Application List ────────────────────────────────────────────────────
export interface LoanApplicationSummary {
  id: string;
  applicationNumber: string;
  applicantName: string;
  productType: string;
  requestedAmount: number;
  status: string;
  createdAt: string;
  assignedTo?: string;
  interestRate?: number;
}

export async function getLoanApplications(page = 1, pageSize = 50): Promise<LoanApplicationSummary[]> {
  const res = await axios.get(API_ROOT, { params: { page, pageSize } });
  return (res.data as any[]).map(d => ({
    id:                norm(d, 'Id', 'id') ?? '',
    applicationNumber: norm(d, 'ApplicationNumber', 'applicationNumber') ?? norm(d, 'Id', 'id') ?? '',
    applicantName:     norm(d, 'ApplicantName', 'applicantName') ?? norm(d, 'CustomerId', 'customerId') ?? 'Unknown',
    productType:       norm(d, 'ProductType', 'productType') ?? '',
    requestedAmount:   norm(d, 'RequestedAmount', 'requestedAmount') ?? norm(d, 'Amount', 'amount') ?? 0,
    status:            norm(d, 'Status', 'status') ?? '',
    createdAt:         norm(d, 'CreatedAt', 'createdAt') ?? '',
    assignedTo:        norm(d, 'AssignedTo', 'assignedTo'),
    interestRate:      norm(d, 'InterestRate', 'interestRate'),
  }));
}

// ── Application List/Detail/Approval ─────────────────────────────────────────
const APPS_ROOT = `${BASE_URL}/api/loans/applications`;

export interface ApplicationSummary {
  id: string;
  applicationNumber: string;
  applicantName: string;
  mobileNumber?: string;
  email?: string;
  productType: string;
  requestedAmount: number;
  tenureMonths: number;
  interestRate?: number;
  status: string;
  cibilScore?: number;
  foirPercent?: number;
  grossMonthlyIncome: number;
  purposeOfLoan?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationListResult {
  total: number;
  page: number;
  pageSize: number;
  items: ApplicationSummary[];
}

export interface ApplicationDetail {
  application: Record<string, any>;
  documents:   Record<string, any>[];
  actions:     ApprovalAction[];
}

export interface ApprovalAction {
  id: string;
  loanApplicationId: string;
  action: string;
  actionBy: string;
  role: string;
  comments?: string;
  fromStatus: string;
  toStatus: string;
  actionAt: string;
}

export interface LoanActionRequest {
  action: string;
  actionBy?: string;
  role?: string;
  comments?: string;
  sanctionedAmount?: number;
}

export async function getApplicationsList(params: {
  status?: string;
  search?: string;
  productType?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApplicationListResult> {
  const res = await axios.get(APPS_ROOT, { params });
  const d = res.data;
  return {
    total:    d.total    ?? d.Total    ?? 0,
    page:     d.page     ?? d.Page     ?? 1,
    pageSize: d.pageSize ?? d.PageSize ?? 20,
    items: (d.items ?? d.Items ?? []).map((a: any) => ({
      id:                a.id                ?? a.Id                ?? '',
      applicationNumber: a.applicationNumber ?? a.ApplicationNumber ?? '',
      applicantName:     a.applicantName     ?? a.ApplicantName     ?? '',
      mobileNumber:      a.mobileNumber      ?? a.MobileNumber,
      email:             a.email             ?? a.Email,
      productType:       a.productType       ?? a.ProductType       ?? '',
      requestedAmount:   a.requestedAmount   ?? a.RequestedAmount   ?? 0,
      tenureMonths:      a.tenureMonths      ?? a.TenureMonths      ?? 0,
      interestRate:      a.interestRate      ?? a.InterestRate,
      status:            a.status            ?? a.Status            ?? '',
      cibilScore:        a.cibilScore        ?? a.CibilScore,
      foirPercent:       a.foirPercent       ?? a.FOIRPercent       ?? a.fOIRPercent,
      grossMonthlyIncome:a.grossMonthlyIncome?? a.GrossMonthlyIncome?? 0,
      purposeOfLoan:     a.purposeOfLoan     ?? a.PurposeOfLoan,
      assignedTo:        a.assignedTo        ?? a.AssignedTo,
      createdAt:         a.createdAt         ?? a.CreatedAt         ?? '',
      updatedAt:         a.updatedAt         ?? a.UpdatedAt         ?? '',
    })),
  };
}

export async function getPendingApprovalList(): Promise<ApplicationSummary[]> {
  const res = await axios.get(`${APPS_ROOT}/pending-approval`);
  return (res.data as any[]).map((a: any) => ({
    id:                a.id                ?? a.Id                ?? '',
    applicationNumber: a.applicationNumber ?? a.ApplicationNumber ?? '',
    applicantName:     a.applicantName     ?? a.ApplicantName     ?? '',
    mobileNumber:      a.mobileNumber      ?? a.MobileNumber,
    email:             a.email             ?? a.Email,
    productType:       a.productType       ?? a.ProductType       ?? '',
    requestedAmount:   a.requestedAmount   ?? a.RequestedAmount   ?? 0,
    tenureMonths:      a.tenureMonths      ?? a.TenureMonths      ?? 0,
    interestRate:      a.interestRate      ?? a.InterestRate,
    status:            a.status            ?? a.Status            ?? '',
    cibilScore:        a.cibilScore        ?? a.CibilScore,
    foirPercent:       a.foirPercent       ?? a.FOIRPercent       ?? a.fOIRPercent,
    grossMonthlyIncome:a.grossMonthlyIncome?? a.GrossMonthlyIncome?? 0,
    purposeOfLoan:     a.purposeOfLoan     ?? a.PurposeOfLoan,
    assignedTo:        a.assignedTo        ?? a.AssignedTo,
    createdAt:         a.createdAt         ?? a.CreatedAt         ?? '',
    updatedAt:         a.updatedAt         ?? a.UpdatedAt         ?? '',
  }));
}

export async function getApplicationDetail(id: string): Promise<ApplicationDetail> {
  const res = await axios.get(`${APPS_ROOT}/${id}`);
  return res.data as ApplicationDetail;
}

export async function takeApplicationAction(id: string, req: LoanActionRequest): Promise<ApplicationDetail> {
  const res = await axios.post(`${APPS_ROOT}/${id}/action`, req);
  return res.data as ApplicationDetail;
}

// ── Loan Repayment (SAAR-LRP-001) ────────────────────────────────────────────
export interface LoanRepayment {
  id: string;
  loanApplicationId: string;
  installmentNumber: number;
  principalComponent: number;
  interestComponent: number;
  totalAmount: number;
  dueDate: string;
  paidAt: string;
  paymentMode: string;
  paymentReference?: string;
  journalNumber?: string;
  tenantId: string;
  createdAt: string;
}

export interface RepaymentHistoryResponse {
  applicationNumber: string;
  outstandingPrincipal?: number;
  nextDueDate?: string;
  smaStatus: string;
  overdueDays: number;
  repayments: LoanRepayment[];
}

export interface CollectEmiRequest {
  amount: number;
  paymentMode: string;
  paymentReference?: string;
  paymentDate?: string;
}

export interface CollectEmiResponse {
  outstandingPrincipal?: number;
  nextDueDate?: string;
  smaStatus: string;
  overdueDays: number;
  repayment: LoanRepayment;
}

export async function getRepaymentHistory(id: string): Promise<RepaymentHistoryResponse> {
  const res = await axios.get(`${APPS_ROOT}/${id}/repayment-history`);
  return res.data as RepaymentHistoryResponse;
}

export async function collectEmi(id: string, req: CollectEmiRequest): Promise<CollectEmiResponse> {
  const res = await axios.post(`${APPS_ROOT}/${id}/collect-emi`, req);
  return res.data as CollectEmiResponse;
}

// ── Legacy exports (backward compat with old LoanOrigination.tsx) ──────────
export type { PreValidateRequest } from './loanOriginationServiceLegacy';
export type { ServerField }        from './loanOriginationServiceLegacy';
export type { WorkflowStepResult } from './loanOriginationServiceLegacy';

export { getFormSchema, preValidate, submitApplication, processWorkflow }
  from './loanOriginationServiceLegacy';

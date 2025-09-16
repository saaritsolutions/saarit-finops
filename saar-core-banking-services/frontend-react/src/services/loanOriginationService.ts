import axios from 'axios';

export interface PreValidateRequest {
  customerId: string;
  loanAmount: number;
  tenureMonths: number;
  creditScore: number;
  monthlyIncome: number;
  debtToIncomeRatio: number;
  productType?: string;
}

export interface PreValidateResponse {
  eligibility: string;
  interestRate?: number | null;
  message?: string;
  failureReasons?: string[];
}

export interface SubmitApplicationResponse {
  status: string;
  applicationId?: string;
  workflowInstanceId?: string;
  currentStep?: string;
  interestRate?: number;
  message?: string;
}

export interface WorkflowStepResult {
  instanceId: string;
  success: boolean;
  currentStep: string;
  nextStep?: string;
  workflowStatus?: string;
  message?: string;
  requiredActions?: string[];
  autoActions?: string[];
  notifications?: string[];
}

export interface ServerField {
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  min?: number | null;
  max?: number | null;
}

const BASE_URL = process.env.REACT_APP_LOAN_SERVICE_BASE_URL || 'http://localhost:5130';
const API_ROOT = `${BASE_URL}/api/LoanOrigination`;

export async function getFormSchema(productType: string): Promise<{ productType?: string; fields?: ServerField[] } | any> {
  const res = await axios.get(`${API_ROOT}/form-schema/${productType}`);
  return res.data;
}

export async function preValidate(payload: PreValidateRequest): Promise<PreValidateResponse> {
  try {
    const res = await axios.post(`${API_ROOT}/pre-validate`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
  // Backend returns PascalCase (Eligibility, InterestRate). Normalize to camelCase.
  const data = res.data ?? {};
  const eligibility = data.eligibility ?? data.Eligibility ?? data.eligibilityStatus ?? data.EligibilityStatus;
  const interestRate = data.interestRate ?? data.InterestRate ?? null;
  const message = data.message ?? data.Message ?? null;
  const failureReasons = data.failureReasons ?? data.FailureReasons ?? null;
  return { eligibility, interestRate, message, failureReasons } as PreValidateResponse;
  } catch (e: any) {
    const status = e?.response?.status;
    const body = e?.response?.data;
    throw Object.assign(new Error('Pre-validate failed'), { status, body });
  }
}

export async function submitApplication(payload: PreValidateRequest): Promise<SubmitApplicationResponse> {
  try {
    const res = await axios.post(`${API_ROOT}/submit`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    // Normalize PascalCase fields from backend to camelCase expected by UI
    const d = res.data ?? {};
    return {
      status: d.status ?? d.Status,
      applicationId: d.applicationId ?? d.ApplicationId,
      workflowInstanceId: d.workflowInstanceId ?? d.WorkflowInstanceId,
      currentStep: d.currentStep ?? d.CurrentStep,
      interestRate: d.interestRate ?? d.InterestRate,
      message: d.message ?? d.Message,
    } as SubmitApplicationResponse;
  } catch (e: any) {
    const status = e?.response?.status;
    const body = e?.response?.data;
    throw Object.assign(new Error('Submit failed'), { status, body });
  }
}

export async function processWorkflow(
  workflowInstanceId: string,
  action: string = 'NEXT',
  context: Record<string, any> = {}
): Promise<WorkflowStepResult> {
  try {
    const res = await axios.post(
      `${API_ROOT}/${workflowInstanceId}/process`,
      { action, context },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return res.data as WorkflowStepResult;
  } catch (e: any) {
    const status = e?.response?.status;
    const body = e?.response?.data;
    throw Object.assign(new Error('Workflow process failed'), { status, body });
  }
}

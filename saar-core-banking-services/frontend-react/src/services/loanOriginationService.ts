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
    return res.data as PreValidateResponse;
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
    return res.data as SubmitApplicationResponse;
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

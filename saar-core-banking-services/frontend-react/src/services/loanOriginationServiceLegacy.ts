import axios from 'axios';

const BASE_URL = process.env.REACT_APP_LOAN_SERVICE_BASE_URL || 'http://localhost:5130';
const API_ROOT = `${BASE_URL}/api/LoanOrigination`;

export interface PreValidateRequest {
  customerId: string;
  loanAmount: number;
  tenureMonths: number;
  creditScore: number;
  monthlyIncome: number;
  debtToIncomeRatio: number;
  productType?: string;
}

export interface ServerField {
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  min?: number | null;
  max?: number | null;
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

export async function getFormSchema(productType: string) {
  const res = await axios.get(`${API_ROOT}/form-schema/${productType}`);
  return res.data;
}

export async function preValidate(payload: PreValidateRequest) {
  const res = await axios.post(`${API_ROOT}/pre-validate`, payload);
  const d = res.data ?? {};
  return {
    eligibility:    d.eligibility ?? d.Eligibility,
    interestRate:   d.interestRate ?? d.InterestRate ?? null,
    message:        d.message ?? d.Message ?? null,
    failureReasons: d.failureReasons ?? d.FailureReasons ?? null,
  };
}

export async function submitApplication(payload: PreValidateRequest) {
  const res = await axios.post(`${API_ROOT}/submit`, payload);
  const d = res.data ?? {};
  return {
    status:             d.status ?? d.Status,
    applicationId:      d.applicationId ?? d.ApplicationId,
    workflowInstanceId: d.workflowInstanceId ?? d.WorkflowInstanceId,
    currentStep:        d.currentStep ?? d.CurrentStep,
    interestRate:       d.interestRate ?? d.InterestRate,
    message:            d.message ?? d.Message,
  };
}

export async function processWorkflow(
  workflowInstanceId: string,
  action: string = 'NEXT',
  context: Record<string, any> = {},
) {
  const res = await axios.post(`${API_ROOT}/${workflowInstanceId}/process`, { action, context });
  return res.data as WorkflowStepResult;
}

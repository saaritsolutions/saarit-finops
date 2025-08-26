import axios from 'axios';

export interface WorkflowStepDef {
  name: string;
  conditionExpressionId?: string | null;
  next?: string | null;
  elseNext?: string | null;
}

export interface WorkflowDefinition {
  workflowType: string;
  startStep?: string | null;
  steps: WorkflowStepDef[];
}

const LOAN_BASE = process.env.REACT_APP_LOAN_SERVICE_BASE_URL || 'http://localhost:5130';

export async function getWorkflowDefinition(workflowType: string): Promise<WorkflowDefinition> {
  const res = await axios.get(`${LOAN_BASE}/api/admin/config/workflow/${workflowType}`);
  return res.data as WorkflowDefinition;
}

export async function saveWorkflowDefinition(workflowType: string, def: WorkflowDefinition): Promise<void> {
  await axios.post(`${LOAN_BASE}/api/admin/config/workflow/${workflowType}`, def, {
    headers: { 'Content-Type': 'application/json' },
  });
}

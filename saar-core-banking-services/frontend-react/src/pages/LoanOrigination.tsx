import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Paper, TextField, Typography, Alert, Stack, Divider, Stepper, Step, StepLabel, Card, CardContent, CardHeader, Chip, Tooltip, IconButton } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import SettingsIcon from '@mui/icons-material/Settings';
import { getFormSchema, preValidate, submitApplication, processWorkflow, type PreValidateRequest, type ServerField, type WorkflowStepResult } from '../services/loanOriginationService';
import WorkflowTimeline from '../components/workflow/WorkflowTimeline';
import { aiFormService } from '../services/aiFormService';
import SchemaForm from '../components/forms/SchemaForm';
import type { FormSchema } from '../services/aiFormService';

type FieldState = Record<string, any>;

function toInitialState(fields: ServerField[]): FieldState {
  const s: FieldState = {};
  for (const f of fields) s[f.name || ''] = '';
  return s;
}

export default function LoanOrigination() {
  const [fields, setFields] = useState<ServerField[]>([]);
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
  const [values, setValues] = useState<FieldState>({});
  const [loading, setLoading] = useState(false);
  const [preValidating, setPreValidating] = useState(false);
  const [pre, setPre] = useState<{ eligibility?: string; interestRate?: number | null; message?: string; failureReasons?: string[]; error?: string; errors?: string[] } | null>(null);
  const [submit, setSubmit] = useState<{ status?: string; message?: string; applicationId?: string; workflowInstanceId?: string; currentStep?: string; error?: string } | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [timeline, setTimeline] = useState<string[]>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [uiError, setUiError] = useState<string | null>(null);
  const PRODUCT_TYPE = 'personal_loan' as const;
  const kycRequired = useMemo(() => {
    const hasAction = availableActions.some(a => /kyc_verify/i.test(a));
    const inStep = /kyc/i.test(submit?.currentStep || '');
    return hasAction || inStep;
  }, [availableActions, submit?.currentStep]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // 1) Primary: Use LoanService-provided schema (reflects admin changes)
        const data = await getFormSchema(PRODUCT_TYPE);
        let list: ServerField[] = [];
        if (Array.isArray(data?.fields)) list = data.fields;
        
        if (list && list.length > 0) {
          // Use the saved schema from admin config
          if (mounted) {
            setFields(list);
            const schemaFromServer: FormSchema = { entityName: 'LoanApplication', title: 'Loan Application', fields: list as any };
            setFormSchema(schemaFromServer);
            setValues(v => ({ ...toInitialState(list), ...v }));
            return; // stop here if saved schema is available
          }
        }

        // 2) Fallback: AI-designed schema if no saved schema
        const aiSchema = await aiFormService.getLastApplied();
        if (mounted && aiSchema?.fields && aiSchema.fields.length > 0) {
          const mapped: ServerField[] = aiSchema.fields.map((f: any) => ({
            name: f.name,
            label: f.label || f.name,
            type: (f.type || 'text').toLowerCase(),
            required: !!f.required,
            min: undefined,
            max: undefined,
          }));
          setFields(mapped);
          setFormSchema(aiSchema as any);
          setValues(v => ({ ...toInitialState(mapped), ...v }));
          return; // stop here if AI schema used
        }

        // 3) Final fallback: hardcoded default schema
        list = [
          { name: 'loanAmount', label: 'Loan Amount', type: 'number', required: true, min: 1000 },
          { name: 'tenureMonths', label: 'Tenure (months)', type: 'number', required: true, min: 6 },
          { name: 'monthlyIncome', label: 'Monthly Income', type: 'number', required: true, min: 1000 },
          { name: 'creditScore', label: 'Credit Score', type: 'number', required: true, min: 300, max: 900 },
          { name: 'debtToIncomeRatio', label: 'Debt-to-Income Ratio', type: 'number', required: true, min: 0, max: 1 },
        ];
        if (mounted) {
          setFields(list);
          setFormSchema({ entityName: 'LoanApplication', title: 'Loan Application', fields: list as any });
          setValues(v => ({ ...toInitialState(list), ...v }));
        }
      } catch (e) {
        // Error fallback: use hardcoded schema
        const fallback: ServerField[] = [
          { name: 'loanAmount', label: 'Loan Amount', type: 'number', required: true, min: 1000 },
          { name: 'tenureMonths', label: 'Tenure (months)', type: 'number', required: true, min: 6 },
          { name: 'monthlyIncome', label: 'Monthly Income', type: 'number', required: true, min: 1000 },
          { name: 'creditScore', label: 'Credit Score', type: 'number', required: true, min: 300, max: 900 },
          { name: 'debtToIncomeRatio', label: 'Debt-to-Income Ratio', type: 'number', required: true, min: 0, max: 1 },
        ];
        if (mounted) {
          setFields(fallback);
          setFormSchema({ entityName: 'LoanApplication', title: 'Loan Application', fields: fallback as any });
          setValues(v => ({ ...toInitialState(fallback), ...v }));
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const setValue = (name: string, val: any) => setValues(v => ({ ...v, [name]: val }));
  const currency = (n: any) => {
    const num = Number(n || 0);
    return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  };

  const buildRequest = (data: FieldState): PreValidateRequest => ({
    customerId: 'CUST-001',
    loanAmount: Number(data['loanAmount'] ?? 0),
    tenureMonths: Number(data['tenureMonths'] ?? 0),
    creditScore: Number(data['creditScore'] ?? 0),
    monthlyIncome: Number(data['monthlyIncome'] ?? 0),
    debtToIncomeRatio: Number(data['debtToIncomeRatio'] ?? 0),
    productType: PRODUCT_TYPE,
  });

  const onPreValidate = async () => {
    setPre(null);
    setPreValidating(true);
    try {
      const req = buildRequest(values);
      const res = await preValidate(req);
      setPre({ 
        eligibility: res.eligibility, 
        interestRate: res.interestRate ?? null,
        message: res.message,
        failureReasons: res.failureReasons
      });
      setActiveStep(1);
    } catch (e: any) {
      if (e?.status === 400 && e.body?.errors) setPre({ error: 'Validation error', errors: e.body.errors });
      else setPre({ error: e?.message || 'Pre-validate failed' });
    } finally {
      setPreValidating(false);
    }
  };

  const onSubmit = async () => {
    setSubmit(null);
    setAvailableActions([]);
    setUiError(null);
    try {
      const req = buildRequest(values);
      const res = await submitApplication(req);
      setSubmit({ status: res.status, message: res.message, applicationId: res.applicationId, workflowInstanceId: res.workflowInstanceId, currentStep: (res as any).currentStep });
      setActiveStep(2);
      if ((res as any).currentStep) setTimeline([`Started: ${(res as any).currentStep}`]);
    } catch (e: any) {
      if (e?.status === 400 && e.body?.errors) setSubmit({ error: `Validation error: ${e.body.errors.join(', ')}` });
      else if (e?.status === 503) setSubmit({ error: 'Workflow service unavailable. Please retry later.' });
      else setSubmit({ error: e?.message || 'Submit failed' });
    }
  };

  const onAdvanceStep = async () => {
    if (!submit?.workflowInstanceId) return;
    try {
      const res: WorkflowStepResult = await processWorkflow(submit.workflowInstanceId, 'NEXT', {
        'workflow.currentStep': submit.currentStep || 'START',
        'loan.amount': values['loanAmount'],
        'loan.type': PRODUCT_TYPE.toUpperCase(),
        'customer.creditScore': values['creditScore']
      });
      const next = res.nextStep || res.currentStep;
      setSubmit(s => s ? { ...s, currentStep: next, status: res.workflowStatus || s.status } : s);
      setAvailableActions(res.requiredActions || []);
      setTimeline(t => [...t, `Advanced to: ${next}`]);
    } catch (e: any) {
      setTimeline(t => [...t, 'Advance failed']);
    }
  };

  const onPerformAction = async (action: string) => {
    if (!submit?.workflowInstanceId) return;
    setUiError(null);

    // If action relates to KYC, ensure we have an aadharNumber in values
    const aadhar = values['aadharNumber'];
    if (/kyc/i.test(action) || /kyc/i.test(submit.currentStep || '')) {
      const aadharStr = (aadhar ?? '').toString().trim();
      if (!aadharStr || aadharStr.length !== 12 || /\D/.test(aadharStr)) {
        setUiError('Please provide a valid 12-digit Aadhar Number before performing KYC.');
        return;
      }
    }

    try {
      const res: WorkflowStepResult = await processWorkflow(submit.workflowInstanceId, action, {
        'workflow.currentStep': submit.currentStep || 'START',
        'loan.amount': values['loanAmount'],
        'loan.type': PRODUCT_TYPE.toUpperCase(),
        'customer.creditScore': values['creditScore'],
        // KYC context (if present)
        'kyc.aadharNumber': values['aadharNumber'] || null,
        'kyc.channel': 'WEB',
      });
      const next = res.nextStep || res.currentStep;
      setSubmit(s => s ? { ...s, currentStep: next, status: res.workflowStatus || s.status, message: res.message || s.message } : s);
      setAvailableActions(res.requiredActions || []);
      setTimeline(t => [...t, `Action ${action} -> ${next}`]);
    } catch (e: any) {
      setUiError(e?.message || `Action ${action} failed`);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: 0.25 }}>Apply for a Loan</Typography>
        {/* Single elegant config entry */}
    <Tooltip title="Open Admin Configuration">
          <IconButton
            component={RouterLink}
            to="/admin/config"
            size="small"
            aria-label="Open Admin Configuration"
          >
      <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      {/* subtle helper for admins */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Configure form, workflow, and expressions in Admin Config (top-right)
      </Typography>
      <Paper sx={{ p: 3, borderRadius: 4 }}>
        <Stack spacing={3}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {["Details", "Eligibility", "Submit"].map(label => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          {/* Removed extra links and debug base URL for a cleaner, elegant look */}
          {loading && <Alert severity="info">Loading schema…</Alert>}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
            <Box sx={{ flex: 1 }}>
                {formSchema && (
                  <SchemaForm
                    schema={formSchema}
                    values={values}
                    onChange={setValue}
                  />
                )}
                {/* Opportunistic KYC field if required and schema didn't include it */}
                {kycRequired && !fields.some(f => (f.name || '').toLowerCase() === 'aadharnumber') && (
                  <TextField
                    fullWidth
                    type="text"
                    label="Aadhar Number"
                    placeholder="12-digit Aadhar"
                    value={(values['aadharNumber'] ?? '') as string}
                    onChange={(e) => setValue('aadharNumber', e.target.value)}
                    helperText="Required for KYC verification"
                    inputProps={{ 'data-testid': 'field-aadharNumber', name: 'aadharNumber' }}
                    sx={{ mt: 2 }}
                  />
                )}

              <Box display="flex" gap={1.5} sx={{ mt: 2 }}>
                <Button 
                  variant="contained" 
                  onClick={onPreValidate}
                  disabled={preValidating}
                  data-cy="pre-validate-button"
                >
                  {preValidating ? 'Validating...' : 'Pre-Validate'}
                </Button>
                <Button variant="outlined" onClick={onSubmit}>Submit</Button>
              </Box>
            </Box>

            <Box sx={{ width: { xs: '100%', md: 360 } }}>
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardHeader title="Summary" subheader="Real-time" />
                <CardContent>
                  <Stack spacing={1.25}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography color="text.secondary">Amount</Typography>
                      <Typography fontWeight={600}>{currency(values['loanAmount'])}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography color="text.secondary">Tenure</Typography>
                      <Typography fontWeight={600}>{values['tenureMonths'] || 0} months</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography color="text.secondary">Income</Typography>
                      <Typography fontWeight={600}>{currency(values['monthlyIncome'])}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography color="text.secondary">Credit Score</Typography>
                      <Typography fontWeight={600}>{values['creditScore'] || '-'}</Typography>
                    </Box>
                    {pre?.eligibility && (
                      <Chip color={pre.eligibility === 'APPROVED' ? 'success' : 'error'} label={`Eligibility: ${pre.eligibility}`} />
                    )}
                    {pre?.interestRate != null && (
                      <Typography>Rate: <b>{pre.interestRate}%</b></Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ borderRadius: 3, mt: 2 }}>
                <CardHeader title="Documents" subheader="Upload KYC" />
                <CardContent>
                  <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Drag & drop files here, or click to select</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {pre && (
            <Card variant="outlined" sx={{ borderRadius: 3 }} data-cy="pre-validation-result">
              <CardHeader title="Pre-Validation Result" />
              <CardContent>
              {pre.error && <Alert severity="error" sx={{ mt: 1 }}>{pre.error}</Alert>}
              {pre.errors && pre.errors.length > 0 && (
                <ul style={{ marginTop: 8 }}>
                  {pre.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {pre.eligibility && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="h6" gutterBottom data-cy="eligibility-result">
                    Eligibility: {pre.eligibility === 'True' ? 'APPROVED' : pre.eligibility === 'False' ? 'DECLINED' : pre.eligibility}
                  </Typography>
                  
                  {pre.message && (
                    <Alert 
                      severity={
                        pre.eligibility === 'APPROVED' || pre.eligibility === 'True' ? 'success' : 
                        pre.eligibility === 'REJECTED' || pre.eligibility === 'DECLINED' || pre.eligibility === 'False' ? 'error' : 
                        'warning'
                      } 
                      sx={{ mt: 1, mb: 2 }}
                      data-cy="eligibility-message"
                    >
                      {pre.message}
                    </Alert>
                  )}
                  
                  {pre.failureReasons && pre.failureReasons.length > 0 && (
                    <Box sx={{ mt: 2 }} data-cy="failure-reasons">
                      <Typography variant="subtitle2" color="error" gutterBottom>
                        Specific Issues:
                      </Typography>
                      <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                        {pre.failureReasons.map((reason, i) => (
                          <Typography component="li" key={i} color="error" sx={{ mb: 0.5 }}>
                            {reason}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  )}
                  
                  <Typography sx={{ mt: 2 }}>
                    Interest Rate: {pre.interestRate ?? 'N/A'}
                  </Typography>
                </Box>
              )}
              </CardContent>
            </Card>
          )}

          {submit && (
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardHeader title="Submission Result" />
              <CardContent>
              {submit.error && <Alert severity="error" sx={{ mt: 1 }}>{submit.error}</Alert>}
              {uiError && <Alert severity="warning" sx={{ mt: 1 }}>{uiError}</Alert>}
              {submit.status && (
                <Box sx={{ mt: 1 }}>
                  <Typography>Status: {submit.status}</Typography>
                  {submit.message && <Typography>Message: {submit.message}</Typography>}
                  {submit.applicationId && <Typography>Application ID: {submit.applicationId}</Typography>}
                  {submit.workflowInstanceId && <Typography>Workflow ID: {submit.workflowInstanceId}</Typography>}
                  {submit.currentStep && <Typography>Current Step: {submit.currentStep}</Typography>}
                  {/* Required actions indicator */}
                  {availableActions.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                      {availableActions.map((act) => (
                        <Chip key={act} color={/kyc/i.test(act) ? 'warning' : 'info'} label={`Required: ${act.replace(/_/g, ' ')}`} size="small" />
                      ))}
                    </Stack>
                  )}
                  {kycRequired && (
                    <Alert severity="info" sx={{ mt: 1 }}>KYC verification required. Provide Aadhar and click the KYC action.</Alert>
                  )}
                  {submit.workflowInstanceId && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                      <Tooltip title={availableActions.length > 0 ? 'Complete required actions first' : ''}>
                        <span>
                          <Button variant="contained" size="small" onClick={onAdvanceStep} disabled={availableActions.length > 0}>Advance Step</Button>
                        </span>
                      </Tooltip>
                      {availableActions.map((act) => (
                        <Button key={act} variant="outlined" size="small" onClick={() => onPerformAction(act)} sx={{ textTransform: 'none' }}>
                          {act.replace(/_/g, ' ')}
                        </Button>
                      ))}
                      {/* Heuristic: show a KYC button when step name mentions KYC even if requiredActions is empty */}
                      {availableActions.length === 0 && /kyc/i.test(submit.currentStep || '') && (
                        <Button variant="outlined" size="small" color="secondary" onClick={() => onPerformAction('KYC_VERIFY')}>
                          Perform KYC
                        </Button>
                      )}
                    </Stack>
                  )}
                  {timeline.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <WorkflowTimeline title="Workflow Timeline" events={timeline} />
                    </Box>
                  )}
                </Box>
              )}
              </CardContent>
            </Card>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Paper, TextField, Typography, Alert, Stack, Divider, Link as MLink, Stepper, Step, StepLabel, Card, CardContent, CardHeader, Chip } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { getFormSchema, preValidate, submitApplication, processWorkflow, type PreValidateRequest, type ServerField, type WorkflowStepResult } from '../services/loanOriginationService';
import WorkflowTimeline from '../components/workflow/WorkflowTimeline';
import { aiFormService } from '../services/aiFormService';

type FieldState = Record<string, any>;

function toInitialState(fields: ServerField[]): FieldState {
  const s: FieldState = {};
  for (const f of fields) s[f.name || ''] = '';
  return s;
}

export default function LoanOrigination() {
  const [fields, setFields] = useState<ServerField[]>([]);
  const [values, setValues] = useState<FieldState>({});
  const [loading, setLoading] = useState(false);
  const [pre, setPre] = useState<{ eligibility?: string; interestRate?: number | null; error?: string; errors?: string[] } | null>(null);
  const [submit, setSubmit] = useState<{ status?: string; message?: string; applicationId?: string; workflowInstanceId?: string; currentStep?: string; error?: string } | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [timeline, setTimeline] = useState<string[]>([]);
  const PRODUCT_TYPE = 'personal_loan' as const;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // 1) Prefer AI-designed schema if available
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
          setValues(v => ({ ...toInitialState(mapped), ...v }));
          return; // stop here if AI schema used
        }

        // 2) Fallback: LoanService-provided schema
        const data = await getFormSchema(PRODUCT_TYPE);
        let list: ServerField[] = [];
        if (Array.isArray(data?.fields)) list = data.fields;
        if (!list || list.length === 0) {
          list = [
            { name: 'loanAmount', label: 'Loan Amount', type: 'number', required: true, min: 1000 },
            { name: 'tenureMonths', label: 'Tenure (months)', type: 'number', required: true, min: 6 },
            { name: 'monthlyIncome', label: 'Monthly Income', type: 'number', required: true, min: 1000 },
            { name: 'creditScore', label: 'Credit Score', type: 'number', required: true, min: 300, max: 900 },
            { name: 'debtToIncomeRatio', label: 'Debt-to-Income Ratio', type: 'number', required: true, min: 0, max: 1 },
          ];
        }
        if (mounted) {
          setFields(list);
          setValues(v => ({ ...toInitialState(list), ...v }));
        }
      } catch (e) {
        const fallback: ServerField[] = [
          { name: 'loanAmount', label: 'Loan Amount', type: 'number', required: true, min: 1000 },
          { name: 'tenureMonths', label: 'Tenure (months)', type: 'number', required: true, min: 6 },
          { name: 'monthlyIncome', label: 'Monthly Income', type: 'number', required: true, min: 1000 },
          { name: 'creditScore', label: 'Credit Score', type: 'number', required: true, min: 300, max: 900 },
          { name: 'debtToIncomeRatio', label: 'Debt-to-Income Ratio', type: 'number', required: true, min: 0, max: 1 },
        ];
        if (mounted) {
          setFields(fallback);
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
    try {
      const req = buildRequest(values);
      const res = await preValidate(req);
      setPre({ eligibility: res.eligibility, interestRate: res.interestRate ?? null });
      setActiveStep(1);
    } catch (e: any) {
      if (e?.status === 400 && e.body?.errors) setPre({ error: 'Validation error', errors: e.body.errors });
      else setPre({ error: e?.message || 'Pre-validate failed' });
    }
  };

  const onSubmit = async () => {
    setSubmit(null);
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
      setTimeline(t => [...t, `Advanced to: ${next}`]);
    } catch (e: any) {
      setTimeline(t => [...t, 'Advance failed']);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, letterSpacing: 0.25 }}>Apply for a Loan</Typography>
      <Paper sx={{ p: 3, borderRadius: 4 }}>
        <Stack spacing={3}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {["Details", "Eligibility", "Submit"].map(label => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <Typography color="text.secondary">Base URL: {process.env.REACT_APP_LOAN_SERVICE_BASE_URL || 'http://localhost:5130'}</Typography>
          <Box display="flex" gap={2}>
            <MLink
              component={RouterLink}
              to={`/admin/ai-form-designer?productType=${PRODUCT_TYPE}&returnTo=/loans/new`}
            >
              Admin Config
            </MLink>
            <MLink component={RouterLink} to="/expressions">Expression Builder</MLink>
          </Box>
          {loading && <Alert severity="info">Loading schema…</Alert>}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}>
                {fields.map((f) => {
                  const name = f.name || '';
                  const type = (f.type || 'text').toLowerCase();
                  const isNumber = type === 'number';
                  return (
                    <TextField
                      key={name}
                      fullWidth
                      type={isNumber ? 'number' : 'text'}
                      label={f.label || name}
                      placeholder={name === 'creditScore' ? 'e.g. 750' : undefined}
                      value={values[name] ?? ''}
                      onChange={(e) => setValue(name, e.target.value)}
                      InputProps={name === 'loanAmount' ? { inputProps: { min: f.min ?? 0 }, startAdornment: <span style={{ marginRight: 6 }}>₹</span> } : undefined}
                    />
                  );
                })}
              </Box>

              <Box display="flex" gap={2} sx={{ mt: 2 }}>
                <Button variant="contained" onClick={onPreValidate}>Pre-Validate</Button>
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
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
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
                  <Typography>Eligibility: {pre.eligibility}</Typography>
                  <Typography>Interest Rate: {pre.interestRate ?? 'N/A'}</Typography>
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
              {submit.status && (
                <Box sx={{ mt: 1 }}>
                  <Typography>Status: {submit.status}</Typography>
                  {submit.message && <Typography>Message: {submit.message}</Typography>}
                  {submit.applicationId && <Typography>Application ID: {submit.applicationId}</Typography>}
                  {submit.workflowInstanceId && <Typography>Workflow ID: {submit.workflowInstanceId}</Typography>}
                  {submit.currentStep && <Typography>Current Step: {submit.currentStep}</Typography>}
                  {submit.workflowInstanceId && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button variant="contained" size="small" onClick={onAdvanceStep}>Advance Step</Button>
                    </Box>
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

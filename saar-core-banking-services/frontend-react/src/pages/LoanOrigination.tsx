import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Alert,
  useTheme,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import SettingsIcon    from '@mui/icons-material/Settings';
import AttachFileIcon  from '@mui/icons-material/AttachFile';
import CloseIcon       from '@mui/icons-material/Close';
import CheckIcon       from '@mui/icons-material/Check';
import DescriptionIcon from '@mui/icons-material/Description';
import VerifiedIcon    from '@mui/icons-material/Verified';
import SendIcon        from '@mui/icons-material/Send';
import {
  getFormSchema,
  preValidate,
  submitApplication,
  processWorkflow,
  type PreValidateRequest,
  type ServerField,
  type WorkflowStepResult,
} from '../services/loanOriginationService';
import WorkflowTimeline, { type WorkflowEvent } from '../components/workflow/WorkflowTimeline';
import { aiFormService }          from '../services/aiFormService';
import SchemaForm                 from '../components/forms/SchemaForm';
import type { FormSchema }        from '../services/aiFormService';
import PageHeader                 from '../components/common/PageHeader';

// ─── Design Tokens ──────────────────────────────────────────────────────────
const BLUE_50   = '#EFF6FF';
const BLUE_100  = '#DBEAFE';
const BLUE_600  = '#2563EB';
const BLUE_700  = '#1D4ED8';
const SLATE_200 = '#E2E8F0';
const SLATE_300 = '#CBD5E1';
const SLATE_400 = '#94A3B8';
const SLATE_500 = '#64748B';
const SLATE_600 = '#475569';
const SLATE_700 = '#334155';
const SLATE_900 = '#0F172A';

// ─── Custom Step Indicator ──────────────────────────────────────────────────

const STEPS = [
  { label: 'Application Details', icon: <DescriptionIcon sx={{ fontSize: 14 }} /> },
  { label: 'Eligibility Check',   icon: <VerifiedIcon    sx={{ fontSize: 14 }} /> },
  { label: 'Submit & Process',    icon: <SendIcon        sx={{ fontSize: 14 }} /> },
];

interface StepIndicatorProps {
  activeStep: number;
  isDark:     boolean;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ activeStep, isDark }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 4 }}>
    {STEPS.map((step, i) => {
      const done    = i < activeStep;
      const current = i === activeStep;
      const pending = i > activeStep;

      return (
        <Box key={step.label} sx={{ display: 'flex', alignItems: 'center' }}>
          {/* Circle */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                width:           32,
                height:          32,
                borderRadius:    '50%',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                transition:      'all 200ms ease',
                backgroundColor: done
                  ? '#10B981'
                  : current
                  ? BLUE_600
                  : (isDark ? '#1F2937' : '#F1F5F9'),
                border:          pending
                  ? `1.5px solid ${isDark ? '#374151' : SLATE_300}`
                  : 'none',
                boxShadow:       current ? `0 0 0 4px ${isDark ? '#1D4ED830' : BLUE_100}` : 'none',
              }}
            >
              {done ? (
                <CheckIcon sx={{ fontSize: 14, color: '#FFFFFF' }} />
              ) : (
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: current ? '#FFFFFF' : (isDark ? SLATE_500 : SLATE_400), lineHeight: 1 }}>
                  {i + 1}
                </Typography>
              )}
            </Box>
            <Typography
              sx={{
                fontSize:   '0.75rem',
                fontWeight: current ? 600 : 500,
                color:      current ? (isDark ? '#F1F5F9' : SLATE_900) : (isDark ? SLATE_500 : SLATE_400),
                whiteSpace: 'nowrap',
                maxWidth:   120,
                textAlign:  'center',
                lineHeight: 1.3,
              }}
            >
              {step.label}
            </Typography>
          </Box>

          {/* Connector */}
          {i < STEPS.length - 1 && (
            <Box
              sx={{
                width:           64,
                height:          1.5,
                mb:              3,
                backgroundColor: i < activeStep
                  ? '#10B981'
                  : (isDark ? '#1F2937' : SLATE_200),
                mx:              1,
                transition:      'background-color 200ms ease',
                flexShrink:      0,
              }}
            />
          )}
        </Box>
      );
    })}
  </Box>
);

// ─── Section Header ─────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; isDark: boolean }> = ({ icon, title, isDark }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
    <Box sx={{ color: BLUE_600, display: 'flex', '& svg': { fontSize: '1.1rem' } }}>{icon}</Box>
    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: isDark ? '#F1F5F9' : SLATE_900 }}>
      {title}
    </Typography>
    <Box sx={{ flex: 1, height: 1, backgroundColor: isDark ? '#1F2937' : SLATE_200, ml: 1 }} />
  </Box>
);

// ─── Types ──────────────────────────────────────────────────────────────────

type FieldState = Record<string, any>;

function toInitialState(fields: ServerField[]): FieldState {
  const s: FieldState = {};
  for (const f of fields) s[f.name || ''] = '';
  return s;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function LoanOrigination() {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [fields,           setFields]           = useState<ServerField[]>([]);
  const [formSchema,       setFormSchema]        = useState<FormSchema | null>(null);
  const [values,           setValues]            = useState<FieldState>({});
  const [loading,          setLoading]           = useState(false);
  const [preValidating,    setPreValidating]     = useState(false);
  const [pre,              setPre]               = useState<{ eligibility?: string; interestRate?: number | null; message?: string; failureReasons?: string[]; error?: string; errors?: string[] } | null>(null);
  const [submit,           setSubmit]            = useState<{ status?: string; message?: string; applicationId?: string; workflowInstanceId?: string; currentStep?: string; error?: string } | null>(null);
  const [activeStep,       setActiveStep]        = useState(0);
  const [timeline,         setTimeline]          = useState<WorkflowEvent[]>([]);
  const [availableActions, setAvailableActions]  = useState<string[]>([]);
  const [uiError,          setUiError]           = useState<string | null>(null);
  const [uploadedFiles,    setUploadedFiles]     = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PRODUCT_TYPE = 'personal_loan' as const;

  const kycRequired = useMemo(() => {
    const hasAction = availableActions.some(a => /kyc_verify/i.test(a));
    const inStep    = /kyc/i.test(submit?.currentStep || '');
    return hasAction || inStep;
  }, [availableActions, submit?.currentStep]);

  // ── Load schema ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getFormSchema(PRODUCT_TYPE);
        let list: ServerField[] = [];
        if (Array.isArray(data?.fields)) list = data.fields;

        if (list && list.length > 0) {
          if (mounted) {
            setFields(list);
            const schemaFromServer: FormSchema = { entityName: 'LoanApplication', title: 'Loan Application', fields: list as any };
            setFormSchema(schemaFromServer);
            setValues(v => ({ ...toInitialState(list), ...v }));
            return;
          }
        }

        const aiSchema = await aiFormService.getLastApplied();
        if (mounted && aiSchema?.fields && aiSchema.fields.length > 0) {
          const mapped: ServerField[] = aiSchema.fields.map((f: any) => ({
            name: f.name, label: f.label || f.name, type: (f.type || 'text').toLowerCase(),
            required: !!f.required, min: undefined, max: undefined,
          }));
          setFields(mapped);
          setFormSchema(aiSchema as any);
          setValues(v => ({ ...toInitialState(mapped), ...v }));
          return;
        }

        const fallback: ServerField[] = [
          { name: 'loanAmount',        label: 'Loan Amount (₹)',       type: 'number', required: true, min: 1000 },
          { name: 'tenureMonths',      label: 'Tenure (months)',       type: 'number', required: true, min: 6   },
          { name: 'monthlyIncome',     label: 'Monthly Income (₹)',    type: 'number', required: true, min: 1000 },
          { name: 'creditScore',       label: 'Credit Score',         type: 'number', required: true, min: 300, max: 900 },
          { name: 'debtToIncomeRatio', label: 'Debt-to-Income Ratio', type: 'number', required: true, min: 0, max: 1 },
        ];
        if (mounted) {
          setFields(fallback);
          setFormSchema({ entityName: 'LoanApplication', title: 'Loan Application', fields: fallback as any });
          setValues(v => ({ ...toInitialState(fallback), ...v }));
        }
      } catch {
        const fallback: ServerField[] = [
          { name: 'loanAmount', label: 'Loan Amount (₹)', type: 'number', required: true, min: 1000 },
          { name: 'tenureMonths', label: 'Tenure (months)', type: 'number', required: true, min: 6 },
          { name: 'monthlyIncome', label: 'Monthly Income (₹)', type: 'number', required: true, min: 1000 },
          { name: 'creditScore', label: 'Credit Score', type: 'number', required: true, min: 300, max: 900 },
          { name: 'debtToIncomeRatio', label: 'Debt-to-Income Ratio', type: 'number', required: true, min: 0, max: 1 },
        ];
        if (mounted) {
          setFields(fallback);
          setFormSchema({ entityName: 'LoanApplication', title: 'Loan Application', fields: fallback as any });
          setValues(v => ({ ...toInitialState(fallback), ...v }));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setValue = (name: string, val: any) => setValues(v => ({ ...v, [name]: val }));

  const currency = (n: any) => {
    const num = Number(n || 0);
    return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  };

  const emi = useMemo(() => {
    const p           = Number(values['loanAmount'] || 0);
    const n           = Number(values['tenureMonths'] || 0);
    const annualRate  = pre?.interestRate;
    if (!p || !n || annualRate == null || annualRate <= 0) return null;
    const r = annualRate / 12 / 100;
    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }, [values, pre?.interestRate]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadedFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    e.target.value = '';
  };
  const handleRemoveFile = (index: number) =>
    setUploadedFiles(prev => prev.filter((_: File, i: number) => i !== index));

  const stepSla = (h = 2) => new Date(Date.now() + h * 3_600_000).toISOString();

  const pushTimelineEvent = (event: WorkflowEvent) =>
    setTimeline((prev: WorkflowEvent[]) => [
      ...prev.map((e: WorkflowEvent) => e.status === 'active' ? { ...e, status: 'completed' as const } : e),
      event,
    ]);

  const onRetryStep = (index: number) =>
    setTimeline((prev: WorkflowEvent[]) =>
      prev.map((e: WorkflowEvent, i: number) => i === index ? { ...e, status: 'active' as const, slaDueAt: stepSla(2) } : e)
    );

  const buildRequest = (data: FieldState): PreValidateRequest => ({
    customerId:         'CUST-001',
    loanAmount:         Number(data['loanAmount'] ?? 0),
    tenureMonths:       Number(data['tenureMonths'] ?? 0),
    creditScore:        Number(data['creditScore'] ?? 0),
    monthlyIncome:      Number(data['monthlyIncome'] ?? 0),
    debtToIncomeRatio:  Number(data['debtToIncomeRatio'] ?? 0),
    productType:        PRODUCT_TYPE,
  });

  const onPreValidate = async () => {
    setPre(null); setPreValidating(true);
    try {
      const res = await preValidate(buildRequest(values));
      setPre({ eligibility: res.eligibility, interestRate: res.interestRate ?? null, message: res.message, failureReasons: res.failureReasons });
      setActiveStep(1);
    } catch (e: any) {
      if (e?.status === 400 && e.body?.errors) setPre({ error: 'Validation error', errors: e.body.errors });
      else setPre({ error: e?.message || 'Pre-validate failed' });
    } finally {
      setPreValidating(false);
    }
  };

  const onSubmit = async () => {
    setSubmit(null); setAvailableActions([]); setUiError(null);
    try {
      const res = await submitApplication(buildRequest(values));
      setSubmit({ status: res.status, message: res.message, applicationId: res.applicationId, workflowInstanceId: res.workflowInstanceId, currentStep: (res as any).currentStep });
      setActiveStep(2);
      if ((res as any).currentStep)
        setTimeline([{ label: `Started: ${(res as any).currentStep}`, status: 'active', timestamp: new Date().toISOString(), slaDueAt: stepSla(2) }]);
    } catch (e: any) {
      if (e?.status === 400 && e.body?.errors) setSubmit({ error: `Validation error: ${e.body.errors.join(', ')}` });
      else if (e?.status === 503)              setSubmit({ error: 'Workflow service unavailable. Please retry later.' });
      else                                     setSubmit({ error: e?.message || 'Submit failed' });
    }
  };

  const onAdvanceStep = async () => {
    if (!submit?.workflowInstanceId) return;
    try {
      const res: WorkflowStepResult = await processWorkflow(submit.workflowInstanceId, 'NEXT', {
        'workflow.currentStep': submit.currentStep || 'START',
        'loan.amount':          values['loanAmount'],
        'loan.type':            PRODUCT_TYPE.toUpperCase(),
        'customer.creditScore': values['creditScore'],
      });
      const next = res.nextStep || res.currentStep;
      setSubmit(s => s ? { ...s, currentStep: next, status: res.workflowStatus || s.status } : s);
      setAvailableActions(res.requiredActions || []);
      pushTimelineEvent({ label: `Advanced to: ${next}`, status: 'active', timestamp: new Date().toISOString(), slaDueAt: stepSla(2) });
    } catch {
      pushTimelineEvent({ label: 'Advance failed', status: 'failed', timestamp: new Date().toISOString(), notes: 'Click the retry button to attempt this step again.' });
    }
  };

  const onPerformAction = async (action: string) => {
    if (!submit?.workflowInstanceId) return;
    setUiError(null);
    if (/kyc/i.test(action) || /kyc/i.test(submit.currentStep || '')) {
      const aadharStr = (values['aadharNumber'] ?? '').toString().trim();
      if (!aadharStr || aadharStr.length !== 12 || /\D/.test(aadharStr)) {
        setUiError('Please provide a valid 12-digit Aadhar Number before performing KYC.');
        return;
      }
    }
    try {
      const res: WorkflowStepResult = await processWorkflow(submit.workflowInstanceId, action, {
        'workflow.currentStep': submit.currentStep || 'START',
        'loan.amount':          values['loanAmount'],
        'loan.type':            PRODUCT_TYPE.toUpperCase(),
        'customer.creditScore': values['creditScore'],
        'kyc.aadharNumber':     values['aadharNumber'] || null,
        'kyc.channel':          'WEB',
      });
      const next = res.nextStep || res.currentStep;
      setSubmit(s => s ? { ...s, currentStep: next, status: res.workflowStatus || s.status, message: res.message || s.message } : s);
      setAvailableActions(res.requiredActions || []);
      pushTimelineEvent({ label: `Action ${action} → ${next}`, status: 'active', timestamp: new Date().toISOString(), slaDueAt: stepSla(2) });
    } catch (e: any) {
      setUiError(e?.message || `Action ${action} failed`);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const approved  = pre?.eligibility === 'APPROVED' || pre?.eligibility === 'True';
  const declined  = pre?.eligibility === 'REJECTED' || pre?.eligibility === 'DECLINED' || pre?.eligibility === 'False';

  return (
    <Box>
      <PageHeader
        title="Loan Origination"
        subtitle="Apply for a new loan — personal, home, or business"
        breadcrumbs={[{ label: 'Products' }, { label: 'Loan Origination' }]}
        actions={
          <Tooltip title="Admin Configuration">
            <IconButton component={RouterLink as any} to="/admin/config" size="small" sx={{ color: isDark ? SLATE_400 : SLATE_500 }}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />

      {/* Custom step indicator */}
      <StepIndicator activeStep={activeStep} isDark={isDark} />

      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>

        {/* ── Left: Form ───────────────────────────────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card sx={{ mb: 2.5 }}>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <SectionHeader icon={<DescriptionIcon />} title="Application Details" isDark={isDark} />

              {loading ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>Loading form schema…</Alert>
              ) : (
                <>
                  {formSchema && <SchemaForm schema={formSchema} values={values} onChange={setValue} />}

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
                </>
              )}
            </CardContent>
          </Card>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5 }}>
            <Button
              variant="contained"
              onClick={onPreValidate}
              disabled={preValidating || loading}
              data-cy="pre-validate-button"
              sx={{ px: 3 }}
            >
              {preValidating ? 'Checking Eligibility…' : 'Check Eligibility'}
            </Button>
            <Button
              variant="outlined"
              onClick={onSubmit}
              disabled={loading}
            >
              Submit Application
            </Button>
          </Box>

          {/* Pre-validation result */}
          {pre && (
            <Card
              sx={{ mb: 2.5, border: approved ? '1px solid #10B98140' : declined ? '1px solid #EF444440' : undefined }}
              data-cy="pre-validation-result"
            >
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <SectionHeader icon={<VerifiedIcon />} title="Eligibility Result" isDark={isDark} />

                {pre.error && <Alert severity="error" sx={{ mb: 2 }}>{pre.error}</Alert>}
                {pre.errors && pre.errors.length > 0 && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {pre.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </Alert>
                )}

                {pre.eligibility && (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                      <Box
                        sx={{
                          px: 1.5, py: 0.5, borderRadius: 8,
                          backgroundColor: approved ? '#ECFDF5' : declined ? '#FEF2F2' : '#FFFBEB',
                          color:           approved ? '#059669' : declined ? '#DC2626' : '#D97706',
                          fontWeight: 700, fontSize: '0.875rem',
                          border: `1px solid ${approved ? '#10B98120' : declined ? '#EF444420' : '#F59E0B20'}`,
                        }}
                      >
                        {pre.eligibility === 'True' ? 'APPROVED' : pre.eligibility === 'False' ? 'DECLINED' : pre.eligibility}
                      </Box>
                      {pre.interestRate != null && (
                        <Typography sx={{ fontSize: '0.875rem', color: isDark ? SLATE_400 : SLATE_500 }}>
                          Interest rate: <strong>{pre.interestRate}% p.a.</strong>
                        </Typography>
                      )}
                    </Box>

                    {pre.message && (
                      <Alert severity={approved ? 'success' : declined ? 'error' : 'warning'} sx={{ mb: 1.5 }} data-cy="eligibility-message">
                        {pre.message}
                      </Alert>
                    )}

                    {pre.failureReasons && pre.failureReasons.length > 0 && (
                      <Box data-cy="failure-reasons">
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#DC2626', mb: 0.75 }}>
                          Issues found:
                        </Typography>
                        <Box component="ul" sx={{ pl: 2, m: 0 }}>
                          {pre.failureReasons.map((reason, i) => (
                            <Typography component="li" key={i} sx={{ fontSize: '0.8125rem', color: '#DC2626', mb: 0.5 }}>
                              {reason}
                            </Typography>
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* Submission result */}
          {submit && (
            <Card>
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <SectionHeader icon={<SendIcon />} title="Submission Result" isDark={isDark} />

                {submit.error  && <Alert severity="error"   sx={{ mb: 2 }}>{submit.error}</Alert>}
                {uiError       && <Alert severity="warning" sx={{ mb: 2 }}>{uiError}</Alert>}

                {submit.status && (
                  <Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                      {[
                        { label: 'Status',         value: submit.status,             highlight: true },
                        { label: 'Application ID', value: submit.applicationId },
                        { label: 'Workflow ID',    value: submit.workflowInstanceId },
                        { label: 'Current Step',   value: submit.currentStep },
                        { label: 'Message',        value: submit.message },
                      ].filter(r => r.value).map(row => (
                        <Box key={row.label} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? SLATE_400 : SLATE_500, minWidth: 120 }}>{row.label}</Typography>
                          <Typography sx={{ fontSize: '0.8125rem', color: row.highlight ? BLUE_600 : (isDark ? SLATE_300 : SLATE_700), fontWeight: row.highlight ? 700 : 400 }}>
                            {row.value}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {availableActions.length > 0 && (
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
                        {availableActions.map(act => (
                          <Chip key={act} color={/kyc/i.test(act) ? 'warning' : 'info'} label={`Required: ${act.replace(/_/g, ' ')}`} size="small" />
                        ))}
                      </Stack>
                    )}
                    {kycRequired && (
                      <Alert severity="info" sx={{ mb: 1.5 }}>KYC verification required. Provide Aadhar and click the KYC action.</Alert>
                    )}

                    {submit.workflowInstanceId && (
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                        <Tooltip title={availableActions.length > 0 ? 'Complete required actions first' : ''}>
                          <span>
                            <Button variant="contained" size="small" onClick={onAdvanceStep} disabled={availableActions.length > 0}>
                              Advance Step
                            </Button>
                          </span>
                        </Tooltip>
                        {availableActions.map(act => (
                          <Button key={act} variant="outlined" size="small" onClick={() => onPerformAction(act)} sx={{ textTransform: 'none' }}>
                            {act.replace(/_/g, ' ')}
                          </Button>
                        ))}
                        {availableActions.length === 0 && /kyc/i.test(submit.currentStep || '') && (
                          <Button variant="outlined" size="small" color="secondary" onClick={() => onPerformAction('KYC_VERIFY')}>
                            Perform KYC
                          </Button>
                        )}
                      </Stack>
                    )}

                    {timeline.length > 0 && <WorkflowTimeline title="Workflow Timeline" events={timeline} onRetry={onRetryStep} />}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </Box>

        {/* ── Right: Summary + Documents ───────────────────────────────────── */}
        <Box sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
          {/* EMI Summary */}
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: isDark ? '#F1F5F9' : SLATE_900, mb: 2 }}>
                Application Summary
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {[
                  { label: 'Loan Amount', value: currency(values['loanAmount']) },
                  { label: 'Tenure',      value: `${values['tenureMonths'] || 0} months` },
                  { label: 'Income',      value: currency(values['monthlyIncome']) },
                  { label: 'Credit Score', value: values['creditScore'] || '—' },
                ].map(row => (
                  <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: isDark ? SLATE_500 : SLATE_500 }}>{row.label}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: isDark ? '#F1F5F9' : SLATE_900 }}>{row.value}</Typography>
                  </Box>
                ))}

                {pre?.interestRate != null && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: isDark ? SLATE_500 : SLATE_500 }}>Interest Rate</Typography>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: BLUE_600 }}>{pre.interestRate}% p.a.</Typography>
                  </Box>
                )}
              </Box>

              {emi != null && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box
                    sx={{
                      p:               2,
                      borderRadius:    10,
                      backgroundColor: isDark ? '#1E3A5F30' : BLUE_50,
                      border:          `1px solid ${isDark ? BLUE_700 + '40' : BLUE_100}`,
                      textAlign:       'center',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: isDark ? '#93C5FD' : BLUE_700, mb: 0.5 }}>
                      Estimated EMI
                    </Typography>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: isDark ? '#93C5FD' : BLUE_600, letterSpacing: '-0.02em' }}>
                      {currency(emi)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: isDark ? SLATE_500 : SLATE_400 }}>per month</Typography>
                  </Box>
                </>
              )}

              {pre?.eligibility && (
                <Box sx={{ mt: 2 }}>
                  <Chip
                    color={approved ? 'success' : declined ? 'error' : 'warning'}
                    label={`Eligibility: ${pre.eligibility === 'True' ? 'APPROVED' : pre.eligibility === 'False' ? 'DECLINED' : pre.eligibility}`}
                    sx={{ width: '100%' }}
                    data-cy="eligibility-result"
                  />
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Document Upload */}
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: isDark ? '#F1F5F9' : SLATE_900, mb: 0.5 }}>
                Documents
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: isDark ? SLATE_500 : SLATE_500, mb: 1.5 }}>
                KYC &amp; Income Proof
              </Typography>

              <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileSelect} />

              <Box
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  p:           2,
                  border:      `1.5px dashed ${isDark ? '#1F2937' : SLATE_300}`,
                  borderRadius: 2,
                  textAlign:   'center',
                  cursor:      'pointer',
                  transition:  'all 150ms ease',
                  '&:hover': {
                    borderColor:     BLUE_600,
                    backgroundColor: isDark ? '#1E3A5F20' : BLUE_50,
                  },
                }}
              >
                <AttachFileIcon fontSize="small" sx={{ color: BLUE_600, mb: 0.5 }} />
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: BLUE_600 }}>
                  Click to attach files
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: isDark ? SLATE_500 : SLATE_400, mt: 0.25 }}>
                  PDF, JPG, PNG accepted
                </Typography>
              </Box>

              {uploadedFiles.length > 0 && (
                <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                  {uploadedFiles.map((file, i) => (
                    <Box
                      key={i}
                      sx={{
                        display:         'flex',
                        alignItems:      'center',
                        px:              1.5,
                        py:              0.75,
                        borderRadius:    8,
                        backgroundColor: isDark ? '#1F2937' : '#F8FAFC',
                        border:          `1px solid ${isDark ? '#374151' : SLATE_200}`,
                        gap:             1,
                      }}
                    >
                      <Typography sx={{ flex: 1, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isDark ? '#F1F5F9' : SLATE_700 }}>
                        {file.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: isDark ? SLATE_500 : SLATE_400, flexShrink: 0 }}>
                        {(file.size / 1024).toFixed(0)} KB
                      </Typography>
                      <IconButton size="small" onClick={() => handleRemoveFile(i)} aria-label="Remove file" sx={{ p: 0.25, color: isDark ? SLATE_500 : SLATE_400, '&:hover': { color: '#DC2626' } }}>
                        <CloseIcon sx={{ fontSize: '0.875rem' }} />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}

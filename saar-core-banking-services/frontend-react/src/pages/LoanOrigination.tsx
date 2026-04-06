import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip,
  CircularProgress, Divider, FormControlLabel, Grid, IconButton,
  InputAdornment, LinearProgress, MenuItem, Radio,
  RadioGroup, Skeleton, Slider, Snackbar, Stack,
  TextField, Tooltip, Typography, useTheme,
} from '@mui/material';
import CheckCircleIcon     from '@mui/icons-material/CheckCircle';
import CancelIcon          from '@mui/icons-material/Cancel';
import WarningAmberIcon    from '@mui/icons-material/WarningAmber';
import AccountBalanceIcon  from '@mui/icons-material/AccountBalance';
import PersonIcon          from '@mui/icons-material/Person';
import WorkIcon            from '@mui/icons-material/Work';
import MonetizationOnIcon  from '@mui/icons-material/MonetizationOn';
import GroupsIcon          from '@mui/icons-material/Groups';
import UploadFileIcon      from '@mui/icons-material/UploadFile';
import RuleIcon            from '@mui/icons-material/Rule';
import AttachFileIcon      from '@mui/icons-material/AttachFile';
import DeleteIcon          from '@mui/icons-material/Delete';
import ArrowBackIcon       from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon    from '@mui/icons-material/ArrowForward';
import SendIcon            from '@mui/icons-material/Send';
import PageHeader          from '../components/common/PageHeader';
import {
  getLoanProducts, getDocumentChecklist, checkEligibility, calculateEMI,
  submitFullApplication,
  type LoanProduct, type DocumentChecklistItem, type EligibilityResult,
} from '../services/loanOriginationService';

// ── Design tokens ─────────────────────────────────────────────────────────────
const BLUE_600  = '#2563EB';
const BLUE_50   = '#EFF6FF';
const SLATE_50  = '#F8FAFC';
const SLATE_200 = '#E2E8F0';
const SLATE_400 = '#94A3B8';
const SLATE_500 = '#64748B';
const SLATE_900 = '#0F172A';

// ── Steps definition ──────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Personal & KYC',      icon: <PersonIcon          sx={{ fontSize: 16 }} /> },
  { label: 'Employment & Income', icon: <WorkIcon             sx={{ fontSize: 16 }} /> },
  { label: 'Loan Parameters',     icon: <MonetizationOnIcon   sx={{ fontSize: 16 }} /> },
  { label: 'Co-Applicant',        icon: <GroupsIcon           sx={{ fontSize: 16 }} /> },
  { label: 'Documents',           icon: <UploadFileIcon       sx={{ fontSize: 16 }} /> },
  { label: 'Review & Submit',     icon: <RuleIcon             sx={{ fontSize: 16 }} /> },
];

// ── Initial form state ────────────────────────────────────────────────────────
const INITIAL_FORM = {
  // Step 1 — Personal & KYC
  applicantName:        '',
  dateOfBirth:          '',
  gender:               '',
  maritalStatus:        '',
  panNumber:            '',
  aadhaarLast4:         '',
  mobileNumber:         '',
  email:                '',
  currentAddressLine1:  '',
  currentAddressLine2:  '',
  currentCity:          '',
  currentState:         '',
  currentPinCode:       '',
  residenceType:        '',
  sameAsCurrent:        true,
  permanentAddressLine1:'',
  permanentAddressLine2:'',
  permanentCity:        '',
  permanentState:       '',
  permanentPinCode:     '',
  // Step 2 — Employment & Income
  employmentType:       '',
  employerName:         '',
  designation:          '',
  yearsAtCurrentJob:    '',
  grossMonthlyIncome:   '',
  netMonthlyIncome:     '',
  otherMonthlyIncome:   '0',
  existingMonthlyEMI:   '0',
  monthlyObligations:   '0',
  cibilScore:           '',
  // Step 3 — Loan Parameters
  productType:          '',
  requestedAmount:      '',
  tenureMonths:         '36',
  purposeOfLoan:        '',
  collateralType:       '',
  collateralValue:      '',
  collateralDescription:'',
  // Step 4 — Co-Applicant
  hasCoApplicant:       false,
  coApplicantName:      '',
  coApplicantPan:       '',
  coApplicantMobile:    '',
  coApplicantIncome:    '',
  // Declaration
  declarationAccepted:  false,
};

type FormState = typeof INITIAL_FORM;

interface UploadedDoc {
  documentType: string;
  documentLabel: string;
  fileName: string;
  size: number;
}

// ── Step Indicator ────────────────────────────────────────────────────────────
const StepIndicator: React.FC<{ activeStep: number }> = ({ activeStep }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', mb: 4, flexWrap: 'wrap', gap: 0 }}>
      {STEPS.map((step, i) => {
        const done    = i < activeStep;
        const current = i === activeStep;
        return (
          <Box key={step.label} sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, minWidth: 70 }}>
              <Box sx={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: done ? '#10B981' : current ? BLUE_600 : (isDark ? '#374151' : SLATE_200),
                color: done || current ? '#fff' : SLATE_400,
                fontSize: done ? 18 : 13,
                fontWeight: 700,
                border: current ? `2px solid ${BLUE_600}` : '2px solid transparent',
                boxShadow: current ? `0 0 0 3px ${BLUE_50}` : 'none',
                transition: 'all 200ms ease',
              }}>
                {done ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : step.icon}
              </Box>
              <Typography sx={{
                fontSize: '0.65rem', fontWeight: current ? 600 : 400,
                color: current ? BLUE_600 : (isDark ? SLATE_400 : SLATE_500),
                textAlign: 'center', lineHeight: 1.3, maxWidth: 64,
              }}>
                {step.label}
              </Typography>
            </Box>
            {i < STEPS.length - 1 && (
              <Box sx={{
                width: 32, height: 2, mb: 2.5,
                backgroundColor: i < activeStep ? '#10B981' : (isDark ? '#374151' : SLATE_200),
                transition: 'background-color 200ms ease',
              }} />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

// ── Section Header ────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, pb: 1.5, borderBottom: `1px solid ${SLATE_200}` }}>
    <Box sx={{ color: BLUE_600, display: 'flex' }}>{icon}</Box>
    <Box>
      <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: SLATE_900 }}>{title}</Typography>
      {subtitle && <Typography sx={{ fontSize: '0.75rem', color: SLATE_500 }}>{subtitle}</Typography>}
    </Box>
  </Box>
);

// ── Product Card ──────────────────────────────────────────────────────────────
const PRODUCT_ICONS: Record<string, string> = {
  PERSONAL_LOAN: '👤', HOME_LOAN: '🏠', BUSINESS_LOAN: '🏢', GOLD_LOAN: '🪙', VEHICLE_LOAN: '🚗',
};

const ProductCard: React.FC<{
  product: LoanProduct; selected: boolean; onClick: () => void;
}> = ({ product, selected, onClick }) => (
  <Card
    onClick={onClick}
    sx={{
      cursor: 'pointer', border: `2px solid ${selected ? BLUE_600 : SLATE_200}`,
      backgroundColor: selected ? BLUE_50 : '#fff',
      borderRadius: 2, transition: 'all 150ms ease',
      '&:hover': { borderColor: BLUE_600, boxShadow: '0 4px 12px rgba(37,99,235,0.12)' },
    }}
  >
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
        <Typography sx={{ fontSize: '1.5rem' }}>{PRODUCT_ICONS[product.productCode] || '💰'}</Typography>
        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: selected ? BLUE_600 : SLATE_900, lineHeight: 1.3 }}>
          {product.name}
        </Typography>
      </Stack>
      <Stack spacing={0.5}>
        <Typography sx={{ fontSize: '0.7rem', color: SLATE_500 }}>
          ₹{(product.minAmount / 100000).toFixed(0)}L – ₹{(product.maxAmount / 100000).toFixed(0)}L
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: SLATE_500 }}>
          {product.baseRatePercent}% p.a. onwards
        </Typography>
        <Chip
          label={product.category}
          size="small"
          sx={{ fontSize: '0.6rem', height: 18, width: 'fit-content',
            backgroundColor: product.category === 'SECURED' ? '#F0FDF4' : '#EFF6FF',
            color: product.category === 'SECURED' ? '#166534' : '#1D4ED8' }}
        />
      </Stack>
    </CardContent>
  </Card>
);

// ── Eligibility Panel ─────────────────────────────────────────────────────────
const EligibilityPanel: React.FC<{
  result: EligibilityResult | null; loading: boolean;
}> = ({ result, loading }) => {
  if (loading) return (
    <Card sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2, p: 2 }}>
      <Skeleton width="60%" height={24} />
      <Skeleton width="80%" height={18} sx={{ mt: 1 }} />
      <Skeleton width="50%" height={18} sx={{ mt: 0.5 }} />
    </Card>
  );
  if (!result) return null;

  const color = result.isEligible ? '#10B981' : '#EF4444';
  const bg    = result.isEligible ? '#F0FDF4' : '#FEF2F2';

  return (
    <Card sx={{ border: `1px solid ${color}30`, backgroundColor: bg, borderRadius: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          {result.isEligible
            ? <CheckCircleIcon sx={{ color: '#10B981', fontSize: 20 }} />
            : <CancelIcon sx={{ color: '#EF4444', fontSize: 20 }} />}
          <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color }}>
            {result.isEligible ? 'Eligible for this loan' : 'Not eligible'}
          </Typography>
        </Stack>
        {result.isEligible && (
          <Grid container spacing={1.5} sx={{ mb: 1 }}>
            <Grid size={{ xs: 6 }}>
              <Typography sx={{ fontSize: '0.7rem', color: SLATE_500 }}>Max Amount</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#10B981' }}>
                ₹{result.maxEligibleAmount.toLocaleString('en-IN')}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography sx={{ fontSize: '0.7rem', color: SLATE_500 }}>Rate</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: SLATE_900 }}>
                {result.recommendedRatePercent}% p.a.
              </Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography sx={{ fontSize: '0.7rem', color: SLATE_500 }}>Monthly EMI</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: SLATE_900 }}>
                ₹{result.proposedMonthlyEMI.toLocaleString('en-IN')}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography sx={{ fontSize: '0.7rem', color: SLATE_500 }}>FOIR</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem',
                color: result.foirPercent > 50 ? '#EF4444' : '#10B981' }}>
                {result.foirPercent}%
              </Typography>
            </Grid>
          </Grid>
        )}
        {result.rejectionReasons.length > 0 && (
          <Stack spacing={0.5}>
            {result.rejectionReasons.map((r, i) => (
              <Typography key={i} sx={{ fontSize: '0.75rem', color: '#EF4444' }}>• {r}</Typography>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

// ── EMI Summary Card ──────────────────────────────────────────────────────────
const EMICard: React.FC<{ amount: number; months: number; rate: number }> = ({ amount, months, rate }) => {
  const r = rate / 12 / 100;
  const factor = r > 0 ? Math.pow(1 + r, months) : 1;
  const emi = r > 0 ? Math.round(amount * r * factor / (factor - 1)) : Math.round(amount / months);
  const total = emi * months;
  const interest = total - amount;

  return (
    <Card sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2, background: 'linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 100%)' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', color: SLATE_500, mb: 1.5 }}>
          EMI ESTIMATE
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.75rem', color: BLUE_600, lineHeight: 1 }}>
          ₹{emi.toLocaleString('en-IN')}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: SLATE_500, mb: 2 }}>per month</Typography>
        <Divider sx={{ mb: 1.5 }} />
        <Stack spacing={0.75}>
          {[
            ['Principal',      `₹${amount.toLocaleString('en-IN')}`],
            ['Total Interest', `₹${interest.toLocaleString('en-IN')}`],
            ['Total Payable',  `₹${total.toLocaleString('en-IN')}`],
            ['Rate',           `${rate}% p.a.`],
            ['Tenure',         `${months} months`],
          ].map(([label, value]) => (
            <Stack key={label} direction="row" justifyContent="space-between">
              <Typography sx={{ fontSize: '0.75rem', color: SLATE_500 }}>{label}</Typography>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: SLATE_900 }}>{value}</Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

// ── Indian States ─────────────────────────────────────────────────────────────
const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
];

const LOAN_PURPOSES = [
  'Home Purchase','Home Construction','Home Renovation','Medical Emergency',
  'Education','Travel','Wedding','Vehicle Purchase','Business Expansion',
  'Debt Consolidation','Working Capital','Equipment Purchase','Other',
];

// ── Main Component ────────────────────────────────────────────────────────────
const LoanOrigination: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [activeStep,    setActiveStep]    = useState(0);
  const [form,          setForm]          = useState<FormState>(INITIAL_FORM);
  const [products,      setProducts]      = useState<LoanProduct[]>([]);
  const [checklist,     setChecklist]     = useState<DocumentChecklistItem[]>([]);
  const [uploadedDocs,  setUploadedDocs]  = useState<Record<string, UploadedDoc>>({});
  const [eligibility,   setEligibility]   = useState<EligibilityResult | null>(null);
  const [eligLoading,   setEligLoading]   = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitted,     setSubmitted]     = useState<{ appId: string; appNumber: string; rate: number } | null>(null);
  const [snackbar,      setSnackbar]      = useState<{ open: boolean; msg: string; severity: 'success'|'error' }>({ open: false, msg: '', severity: 'success' });
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  const eligTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget]  = useState<string | null>(null);

  const setField = useCallback((k: keyof FormState, v: any) =>
    setForm(f => ({ ...f, [k]: v })), []);

  // ── Load products ─────────────────────────────────────────────────────────
  useEffect(() => {
    getLoanProducts()
      .then(setProducts)
      .catch(() => setSnackbar({ open: true, msg: 'Could not load loan products', severity: 'error' }));
  }, []);

  // ── Load checklist when product changes ──────────────────────────────────
  useEffect(() => {
    if (!form.productType) { setChecklist([]); return; }
    getDocumentChecklist(form.productType)
      .then(r => setChecklist(r.items))
      .catch(() => setChecklist([]));
  }, [form.productType]);

  // ── Debounced eligibility check ──────────────────────────────────────────
  useEffect(() => {
    if (activeStep !== 2) return;
    if (!form.productType || !form.requestedAmount || !form.grossMonthlyIncome) return;
    if (eligTimerRef.current) clearTimeout(eligTimerRef.current);
    eligTimerRef.current = setTimeout(async () => {
      setEligLoading(true);
      try {
        const r = await checkEligibility({
          productType:         form.productType,
          requestedAmount:     parseFloat(form.requestedAmount) || 0,
          tenureMonths:        parseInt(form.tenureMonths) || 36,
          grossMonthlyIncome:  parseFloat(form.grossMonthlyIncome) || 0,
          existingMonthlyEMI:  parseFloat(form.existingMonthlyEMI) || 0,
          proposedMonthlyEMI:  0,
          cibilScore:          parseInt(form.cibilScore) || 0,
          collateralValue:     parseFloat(form.collateralValue) || 0,
        });
        setEligibility(r);
      } catch { setEligibility(null); }
      finally  { setEligLoading(false); }
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.productType, form.requestedAmount, form.tenureMonths, form.grossMonthlyIncome,
      form.existingMonthlyEMI, form.cibilScore, form.collateralValue, activeStep]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validateStep = (): boolean => {
    const e: Record<string, string> = {};
    if (activeStep === 0) {
      if (!form.applicantName.trim())       e.applicantName = 'Required';
      if (!form.dateOfBirth)                e.dateOfBirth   = 'Required';
      if (!form.gender)                     e.gender        = 'Required';
      if (!form.panNumber.match(/^[A-Z]{5}[0-9]{4}[A-Z]$/))
                                            e.panNumber     = 'Format: ABCDE1234F';
      if (!form.mobileNumber.match(/^[6-9]\d{9}$/))
                                            e.mobileNumber  = '10-digit mobile starting with 6-9';
      if (!form.email.includes('@'))        e.email         = 'Valid email required';
      if (!form.currentAddressLine1.trim()) e.currentAddressLine1 = 'Required';
      if (!form.currentCity.trim())         e.currentCity   = 'Required';
      if (!form.currentState)               e.currentState  = 'Required';
      if (!form.currentPinCode.match(/^\d{6}$/)) e.currentPinCode = '6-digit PIN';
    }
    if (activeStep === 1) {
      if (!form.employmentType)             e.employmentType   = 'Required';
      if (!form.employerName.trim())        e.employerName     = 'Required';
      if (!form.grossMonthlyIncome || parseFloat(form.grossMonthlyIncome) < 10000)
                                            e.grossMonthlyIncome = 'Minimum ₹10,000';
    }
    if (activeStep === 2) {
      if (!form.productType)                e.productType     = 'Select a loan product';
      if (!form.requestedAmount || parseFloat(form.requestedAmount) <= 0)
                                            e.requestedAmount = 'Enter loan amount';
      if (!form.purposeOfLoan)              e.purposeOfLoan   = 'Required';
    }
    if (activeStep === 4) {
      const mandatoryMissing = checklist
        .filter(c => c.isMandatory && !uploadedDocs[c.documentType])
        .map(c => c.documentLabel);
      if (mandatoryMissing.length)
        e.documents = `Upload mandatory documents: ${mandatoryMissing.join(', ')}`;
    }
    if (activeStep === 5) {
      if (!form.declarationAccepted) e.declarationAccepted = 'Please accept the declaration';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    // Skip step 3 (co-applicant) if product doesn't allow it
    if (activeStep === 2 && !form.hasCoApplicant) {
      const product = products.find(p => p.productCode === form.productType);
      if (!product?.allowsCoApplicant) { setActiveStep(4); return; }
    }
    setActiveStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => setActiveStep(s => Math.max(s - 1, 0));

  // ── Document Upload ───────────────────────────────────────────────────────
  const handleUploadClick = (docType: string) => {
    setUploadTarget(docType);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    setUploadedDocs(prev => ({
      ...prev,
      [uploadTarget]: { documentType: uploadTarget, documentLabel: uploadTarget, fileName: file.name, size: file.size },
    }));
    e.target.value = '';
    setUploadTarget(null);
  };

  const handleRemoveDoc = (docType: string) => {
    setUploadedDocs(prev => { const n = { ...prev }; delete n[docType]; return n; });
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      const res = await submitFullApplication({
        applicantName:        form.applicantName,
        dateOfBirth:          form.dateOfBirth,
        gender:               form.gender,
        maritalStatus:        form.maritalStatus,
        panNumber:            form.panNumber,
        aadhaarLast4:         form.aadhaarLast4,
        mobileNumber:         form.mobileNumber,
        email:                form.email,
        currentAddressLine1:  form.currentAddressLine1,
        currentAddressLine2:  form.currentAddressLine2,
        currentCity:          form.currentCity,
        currentState:         form.currentState,
        currentPinCode:       form.currentPinCode,
        residenceType:        form.residenceType,
        sameAsCurrent:        form.sameAsCurrent,
        permanentAddressLine1:form.sameAsCurrent ? form.currentAddressLine1 : form.permanentAddressLine1,
        permanentCity:        form.sameAsCurrent ? form.currentCity         : form.permanentCity,
        permanentState:       form.sameAsCurrent ? form.currentState        : form.permanentState,
        permanentPinCode:     form.sameAsCurrent ? form.currentPinCode      : form.permanentPinCode,
        employmentType:       form.employmentType,
        employerName:         form.employerName,
        designation:          form.designation,
        yearsAtCurrentJob:    parseInt(form.yearsAtCurrentJob) || 0,
        grossMonthlyIncome:   parseFloat(form.grossMonthlyIncome) || 0,
        netMonthlyIncome:     parseFloat(form.netMonthlyIncome) || 0,
        otherMonthlyIncome:   parseFloat(form.otherMonthlyIncome) || 0,
        existingMonthlyEMI:   parseFloat(form.existingMonthlyEMI) || 0,
        monthlyObligations:   parseFloat(form.monthlyObligations) || 0,
        cibilScore:           parseInt(form.cibilScore) || 0,
        productType:          form.productType,
        requestedAmount:      parseFloat(form.requestedAmount) || 0,
        tenureMonths:         parseInt(form.tenureMonths) || 36,
        purposeOfLoan:        form.purposeOfLoan,
        collateralType:       form.collateralType,
        collateralValue:      parseFloat(form.collateralValue) || 0,
        collateralDescription:form.collateralDescription,
        hasCoApplicant:       form.hasCoApplicant,
      });
      setSubmitted({
        appId:     res.applicationId ?? '',
        appNumber: res.applicationNumber ?? `LAP-${Date.now()}`,
        rate:      res.interestRate ?? eligibility?.recommendedRatePercent ?? 0,
      });
    } catch (err: any) {
      setSnackbar({ open: true, msg: err?.message || 'Submission failed', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success Screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 6, textAlign: 'center', px: 2 }}>
        <Box sx={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: '#F0FDF4',
          display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
          <CheckCircleIcon sx={{ fontSize: 40, color: '#10B981' }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Application Submitted!</Typography>
        <Typography sx={{ color: SLATE_500, mb: 3 }}>
          Your loan application has been received and is under review.
        </Typography>
        <Card sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2, mb: 3 }}>
          <CardContent>
            <Stack spacing={1.5}>
              {[
                ['Application Number', submitted.appNumber],
                ['Reference ID',       submitted.appId?.slice(0, 8)?.toUpperCase()],
                ['Interest Rate',      submitted.rate ? `${submitted.rate}% p.a.` : 'To be determined'],
                ['Next Step',          'Credit team review within 24 hours'],
              ].map(([label, value]) => (
                <Stack key={label} direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: '0.875rem', color: SLATE_500 }}>{label}</Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{value}</Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
        <Button variant="contained" onClick={() => { setSubmitted(null); setForm(INITIAL_FORM); setActiveStep(0); }}>
          New Application
        </Button>
      </Box>
    );
  }

  const selectedProduct = products.find(p => p.productCode === form.productType);
  const amount = parseFloat(form.requestedAmount) || 0;
  const months = parseInt(form.tenureMonths) || 36;
  const rate   = eligibility?.recommendedRatePercent ?? selectedProduct?.baseRatePercent ?? 12;

  const uploadedCount  = checklist.filter(c => uploadedDocs[c.documentType]).length;
  const mandatoryTotal = checklist.filter(c => c.isMandatory).length;
  const uploadedMandatory = checklist.filter(c => c.isMandatory && uploadedDocs[c.documentType]).length;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, md: 3 }, pb: 6 }}>
      <PageHeader
        title="New Loan Application"
        subtitle="Complete all sections to submit your application"
        breadcrumbs={[{ label: 'Loans', href: '/loans' }, { label: 'New Application' }]}
      />

      <StepIndicator activeStep={activeStep} />

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" style={{ display: 'none' }}
        accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />

      {/* ── Step 0: Personal & KYC ── */}
      {activeStep === 0 && (
        <Card sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <SectionHeader icon={<PersonIcon />} title="Personal Details" subtitle="As per government-issued ID" />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField fullWidth label="Full Name (as per PAN)" required
                  value={form.applicantName} onChange={e => setField('applicantName', e.target.value)}
                  error={!!errors.applicantName} helperText={errors.applicantName} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth label="Date of Birth" type="date" required
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ max: new Date(Date.now() - 21 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0,10) }}
                  value={form.dateOfBirth} onChange={e => setField('dateOfBirth', e.target.value)}
                  error={!!errors.dateOfBirth} helperText={errors.dateOfBirth} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth select label="Gender" required
                  value={form.gender} onChange={e => setField('gender', e.target.value)}
                  error={!!errors.gender} helperText={errors.gender}>
                  {['Male','Female','Other'].map(g => <MenuItem key={g} value={g[0]}>{g}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth select label="Marital Status"
                  value={form.maritalStatus} onChange={e => setField('maritalStatus', e.target.value)}>
                  {['Single','Married','Divorced','Widowed'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth select label="Residence Type" required
                  value={form.residenceType} onChange={e => setField('residenceType', e.target.value)}>
                  {['OWNED','RENTED','PARENTAL','COMPANY_PROVIDED'].map(r =>
                    <MenuItem key={r} value={r}>{r.replace('_',' ')}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3 }}>
              <SectionHeader icon={<AccountBalanceIcon sx={{ fontSize: 20 }} />} title="KYC Details" />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="PAN Number" required
                    inputProps={{ maxLength: 10, style: { textTransform: 'uppercase' } }}
                    value={form.panNumber} onChange={e => setField('panNumber', e.target.value.toUpperCase())}
                    error={!!errors.panNumber} helperText={errors.panNumber || 'Format: ABCDE1234F'} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="Aadhaar (last 4 digits)"
                    inputProps={{ maxLength: 4 }}
                    value={form.aadhaarLast4} onChange={e => setField('aadhaarLast4', e.target.value.replace(/\D/g,''))}
                    helperText="Only last 4 digits stored" />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="Mobile Number" required
                    InputProps={{ startAdornment: <InputAdornment position="start">+91</InputAdornment> }}
                    inputProps={{ maxLength: 10 }}
                    value={form.mobileNumber} onChange={e => setField('mobileNumber', e.target.value.replace(/\D/g,''))}
                    error={!!errors.mobileNumber} helperText={errors.mobileNumber} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="Email Address" required type="email"
                    value={form.email} onChange={e => setField('email', e.target.value)}
                    error={!!errors.email} helperText={errors.email} />
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ mt: 3 }}>
              <SectionHeader icon={<AccountBalanceIcon sx={{ fontSize: 20 }} />} title="Current Address" />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <TextField fullWidth label="Address Line 1" required
                    value={form.currentAddressLine1} onChange={e => setField('currentAddressLine1', e.target.value)}
                    error={!!errors.currentAddressLine1} helperText={errors.currentAddressLine1} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField fullWidth label="Address Line 2 (optional)"
                    value={form.currentAddressLine2} onChange={e => setField('currentAddressLine2', e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="City" required
                    value={form.currentCity} onChange={e => setField('currentCity', e.target.value)}
                    error={!!errors.currentCity} helperText={errors.currentCity} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth select label="State" required
                    value={form.currentState} onChange={e => setField('currentState', e.target.value)}
                    error={!!errors.currentState} helperText={errors.currentState}>
                    {INDIAN_STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="PIN Code" required
                    inputProps={{ maxLength: 6 }}
                    value={form.currentPinCode} onChange={e => setField('currentPinCode', e.target.value.replace(/\D/g,''))}
                    error={!!errors.currentPinCode} helperText={errors.currentPinCode} />
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={<Checkbox checked={form.sameAsCurrent} onChange={e => setField('sameAsCurrent', e.target.checked)} />}
                label="Permanent address same as current address" />
            </Box>

            {!form.sameAsCurrent && (
              <Box sx={{ mt: 2 }}>
                <SectionHeader icon={<AccountBalanceIcon sx={{ fontSize: 20 }} />} title="Permanent Address" />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="Address Line 1"
                      value={form.permanentAddressLine1} onChange={e => setField('permanentAddressLine1', e.target.value)} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField fullWidth label="City"
                      value={form.permanentCity} onChange={e => setField('permanentCity', e.target.value)} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField fullWidth select label="State"
                      value={form.permanentState} onChange={e => setField('permanentState', e.target.value)}>
                      {INDIAN_STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField fullWidth label="PIN Code"
                      inputProps={{ maxLength: 6 }}
                      value={form.permanentPinCode} onChange={e => setField('permanentPinCode', e.target.value.replace(/\D/g,''))} />
                  </Grid>
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 1: Employment & Income ── */}
      {activeStep === 1 && (
        <Card sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <SectionHeader icon={<WorkIcon />} title="Employment Details" />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth select label="Employment Type" required
                  value={form.employmentType} onChange={e => setField('employmentType', e.target.value)}
                  error={!!errors.employmentType} helperText={errors.employmentType}>
                  {[
                    ['SALARIED','Salaried'],['SELF_EMPLOYED','Self-Employed'],
                    ['BUSINESS_OWNER','Business Owner'],['RETIRED','Retired'],['OTHERS','Others'],
                  ].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <TextField fullWidth label="Employer / Company Name" required
                  value={form.employerName} onChange={e => setField('employerName', e.target.value)}
                  error={!!errors.employerName} helperText={errors.employerName} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField fullWidth label="Designation"
                  value={form.designation} onChange={e => setField('designation', e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth label="Years at Current Job" type="number"
                  inputProps={{ min: 0, max: 50 }}
                  value={form.yearsAtCurrentJob} onChange={e => setField('yearsAtCurrentJob', e.target.value)} />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3 }}>
              <SectionHeader icon={<MonetizationOnIcon sx={{ fontSize: 20 }} />}
                title="Income & Liabilities"
                subtitle="Monthly figures in Indian Rupees (₹)" />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="Gross Monthly Income" required type="number"
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    value={form.grossMonthlyIncome} onChange={e => setField('grossMonthlyIncome', e.target.value)}
                    error={!!errors.grossMonthlyIncome} helperText={errors.grossMonthlyIncome || 'Before deductions'} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="Net Monthly Income" type="number"
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    value={form.netMonthlyIncome} onChange={e => setField('netMonthlyIncome', e.target.value)}
                    helperText="After TDS/PF deductions" />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="Other Monthly Income" type="number"
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    value={form.otherMonthlyIncome} onChange={e => setField('otherMonthlyIncome', e.target.value)}
                    helperText="Rental, freelance, etc." />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="Existing Monthly EMIs" type="number"
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    value={form.existingMonthlyEMI} onChange={e => setField('existingMonthlyEMI', e.target.value)}
                    helperText="Total of all running loans" />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="Other Monthly Obligations" type="number"
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    value={form.monthlyObligations} onChange={e => setField('monthlyObligations', e.target.value)}
                    helperText="Credit card, insurance, etc." />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="CIBIL Score" type="number"
                    inputProps={{ min: 300, max: 900 }}
                    value={form.cibilScore} onChange={e => setField('cibilScore', e.target.value)}
                    helperText="300–900. Leave 0 if unknown."
                    InputProps={{
                      endAdornment: form.cibilScore && parseInt(form.cibilScore) >= 700
                        ? <InputAdornment position="end"><CheckCircleIcon sx={{ color: '#10B981', fontSize: 18 }} /></InputAdornment>
                        : undefined,
                    }} />
                </Grid>
              </Grid>
            </Box>

            {/* Live FOIR indicator */}
            {form.grossMonthlyIncome && parseFloat(form.grossMonthlyIncome) > 0 && (
              <Box sx={{ mt: 2, p: 2, backgroundColor: SLATE_50, borderRadius: 2, border: `1px solid ${SLATE_200}` }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: SLATE_500, mb: 1 }}>
                  FIXED OBLIGATION TO INCOME RATIO (FOIR)
                </Typography>
                {(() => {
                  const income = parseFloat(form.grossMonthlyIncome) || 1;
                  const existing = parseFloat(form.existingMonthlyEMI) || 0;
                  const foir = Math.round((existing / income) * 100);
                  const available = Math.max(0, Math.round((income * 50 / 100) - existing));
                  return (
                    <Stack direction="row" spacing={3}>
                      <Box>
                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: foir > 50 ? '#EF4444' : '#10B981' }}>
                          {foir}%
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: SLATE_500 }}>Current FOIR</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: SLATE_900 }}>
                          ₹{available.toLocaleString('en-IN')}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: SLATE_500 }}>Available for EMI</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: SLATE_900 }}>50%</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: SLATE_500 }}>Max FOIR allowed</Typography>
                      </Box>
                    </Stack>
                  );
                })()}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Loan Parameters ── */}
      {activeStep === 2 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <SectionHeader icon={<MonetizationOnIcon />} title="Select Loan Product" />
                {errors.productType && <Alert severity="error" sx={{ mb: 2 }}>{errors.productType}</Alert>}
                {products.length === 0
                  ? <Grid container spacing={2}>{[1,2,3,4,5].map(i =>
                      <Grid key={i} size={{ xs: 6, md: 4 }}><Skeleton height={120} variant="rounded" /></Grid>)}
                    </Grid>
                  : <Grid container spacing={2}>
                      {products.map(p => (
                        <Grid key={p.productCode} size={{ xs: 6, md: 4 }}>
                          <ProductCard product={p} selected={form.productType === p.productCode}
                            onClick={() => setField('productType', p.productCode)} />
                        </Grid>
                      ))}
                    </Grid>
                }

                {form.productType && (
                  <Box sx={{ mt: 3 }}>
                    <SectionHeader icon={<MonetizationOnIcon sx={{ fontSize: 20 }} />} title="Loan Details" />
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12 }}>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: SLATE_500, mb: 1 }}>
                          Loan Amount (₹)
                        </Typography>
                        <Box sx={{ px: 1 }}>
                          <Slider
                            value={parseFloat(form.requestedAmount) || 0}
                            min={selectedProduct?.minAmount ?? 50000}
                            max={selectedProduct?.maxAmount ?? 4000000}
                            step={10000}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(v: number) => `₹${(v/100000).toFixed(1)}L`}
                            onChange={(_: Event, v: number | number[]) => setField('requestedAmount', String(v as number))}
                            sx={{ color: BLUE_600 }}
                          />
                          <Stack direction="row" justifyContent="space-between" mt={0.5}>
                            <Typography sx={{ fontSize: '0.7rem', color: SLATE_400 }}>
                              ₹{((selectedProduct?.minAmount ?? 0)/100000).toFixed(1)}L
                            </Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: SLATE_400 }}>
                              ₹{((selectedProduct?.maxAmount ?? 0)/100000).toFixed(1)}L
                            </Typography>
                          </Stack>
                          <TextField fullWidth label="Or enter amount" type="number" size="small" sx={{ mt: 1 }}
                            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                            value={form.requestedAmount}
                            onChange={e => setField('requestedAmount', e.target.value)}
                            error={!!errors.requestedAmount} helperText={errors.requestedAmount} />
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField fullWidth select label="Tenure" required
                          value={form.tenureMonths} onChange={e => setField('tenureMonths', e.target.value)}>
                          {[6,12,18,24,36,48,60,84,120,180,240,300].filter(m =>
                            m >= (selectedProduct?.minTenureMonths ?? 6) &&
                            m <= (selectedProduct?.maxTenureMonths ?? 300)).map(m =>
                            <MenuItem key={m} value={String(m)}>{m} months ({(m/12).toFixed(m%12===0?0:1)} yr)</MenuItem>)}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField fullWidth select label="Purpose of Loan" required
                          value={form.purposeOfLoan} onChange={e => setField('purposeOfLoan', e.target.value)}
                          error={!!errors.purposeOfLoan} helperText={errors.purposeOfLoan}>
                          {LOAN_PURPOSES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                        </TextField>
                      </Grid>

                      {selectedProduct?.requiresCollateral && (
                        <>
                          <Grid size={{ xs: 12 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: SLATE_900, mt: 1 }}>
                              Collateral Details
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <TextField fullWidth select label="Collateral Type"
                              value={form.collateralType} onChange={e => setField('collateralType', e.target.value)}>
                              {['PROPERTY','GOLD','VEHICLE','FD','SHARES'].map(c =>
                                <MenuItem key={c} value={c}>{c}</MenuItem>)}
                            </TextField>
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <TextField fullWidth label="Collateral Value (₹)" type="number"
                              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                              value={form.collateralValue} onChange={e => setField('collateralValue', e.target.value)} />
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <TextField fullWidth label="Description"
                              value={form.collateralDescription} onChange={e => setField('collateralDescription', e.target.value)} />
                          </Grid>
                        </>
                      )}
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* EMI + Eligibility side panel */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2}>
              {amount > 0 && months > 0 && (
                <EMICard amount={amount} months={months} rate={rate} />
              )}
              <EligibilityPanel result={eligibility} loading={eligLoading} />
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* ── Step 3: Co-Applicant ── */}
      {activeStep === 3 && (
        <Card sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <SectionHeader icon={<GroupsIcon />} title="Co-Applicant / Guarantor"
              subtitle="Optional — may improve eligibility" />
            <FormControlLabel
              control={<Checkbox checked={form.hasCoApplicant} onChange={e => setField('hasCoApplicant', e.target.checked)} />}
              label="Add a co-applicant" sx={{ mb: 2 }} />
            {form.hasCoApplicant && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="Co-Applicant Full Name"
                    value={form.coApplicantName} onChange={e => setField('coApplicantName', e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth label="PAN Number"
                    inputProps={{ maxLength: 10, style: { textTransform: 'uppercase' } }}
                    value={form.coApplicantPan} onChange={e => setField('coApplicantPan', e.target.value.toUpperCase())} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth label="Mobile"
                    inputProps={{ maxLength: 10 }}
                    value={form.coApplicantMobile} onChange={e => setField('coApplicantMobile', e.target.value.replace(/\D/,''))} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="Monthly Income (₹)" type="number"
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    value={form.coApplicantIncome} onChange={e => setField('coApplicantIncome', e.target.value)} />
                </Grid>
              </Grid>
            )}
            {!form.hasCoApplicant && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Adding a co-applicant with a high CIBIL score or income can significantly increase your loan eligibility.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Documents ── */}
      {activeStep === 4 && (
        <Card sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <SectionHeader icon={<UploadFileIcon />} title="Document Upload"
              subtitle={`${uploadedMandatory} of ${mandatoryTotal} mandatory documents uploaded`} />

            {mandatoryTotal > 0 && (
              <Box sx={{ mb: 3 }}>
                <Stack direction="row" justifyContent="space-between" mb={0.5}>
                  <Typography sx={{ fontSize: '0.75rem', color: SLATE_500 }}>
                    {uploadedCount} of {checklist.length} documents uploaded
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600,
                    color: uploadedMandatory === mandatoryTotal ? '#10B981' : BLUE_600 }}>
                    {Math.round(uploadedMandatory / mandatoryTotal * 100)}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={mandatoryTotal > 0 ? (uploadedMandatory / mandatoryTotal) * 100 : 0}
                  sx={{ borderRadius: 4, height: 6,
                    '& .MuiLinearProgress-bar': { backgroundColor: uploadedMandatory === mandatoryTotal ? '#10B981' : BLUE_600 } }} />
              </Box>
            )}

            {errors.documents && <Alert severity="error" sx={{ mb: 2 }}>{errors.documents}</Alert>}

            <Stack spacing={1.5}>
              {checklist.length === 0 && (
                <Alert severity="info">Select a loan product in Step 3 to see the document checklist.</Alert>
              )}
              {checklist.map(item => {
                const uploaded = uploadedDocs[item.documentType];
                return (
                  <Box key={item.documentType} sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    p: 2, borderRadius: 1.5,
                    border: `1px solid ${uploaded ? '#BBF7D0' : (item.isMandatory ? '#FECACA' : SLATE_200)}`,
                    backgroundColor: uploaded ? '#F0FDF4' : '#fff',
                    gap: 2,
                  }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" flex={1}>
                      <Box sx={{ color: uploaded ? '#10B981' : (item.isMandatory ? '#EF4444' : SLATE_400) }}>
                        {uploaded ? <CheckCircleIcon sx={{ fontSize: 20 }} /> : <AttachFileIcon sx={{ fontSize: 20 }} />}
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                          {item.documentLabel}
                          {item.isMandatory && <Typography component="span" sx={{ color: '#EF4444', ml: 0.5 }}>*</Typography>}
                        </Typography>
                        {uploaded
                          ? <Typography sx={{ fontSize: '0.7rem', color: '#10B981' }}>
                              {uploaded.fileName} ({(uploaded.size / 1024).toFixed(0)} KB)
                            </Typography>
                          : <Typography sx={{ fontSize: '0.7rem', color: SLATE_400 }}>
                              {item.acceptedFormats.join(', ')} accepted
                            </Typography>}
                      </Box>
                    </Stack>
                    {uploaded
                      ? <Tooltip title="Remove"><IconButton size="small" color="error" onClick={() => handleRemoveDoc(item.documentType)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton></Tooltip>
                      : <Button size="small" variant="outlined" onClick={() => handleUploadClick(item.documentType)}
                          startIcon={<UploadFileIcon />} sx={{ flexShrink: 0, fontSize: '0.75rem' }}>
                          Upload
                        </Button>}
                  </Box>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* ── Step 5: Review & Submit ── */}
      {activeStep === 5 && (
        <Stack spacing={2}>
          {/* Personal Summary */}
          <Card sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <SectionHeader icon={<PersonIcon />} title="Personal Details" />
              <Grid container spacing={2}>
                {[
                  ['Full Name', form.applicantName],
                  ['Date of Birth', form.dateOfBirth],
                  ['PAN', form.panNumber],
                  ['Mobile', `+91 ${form.mobileNumber}`],
                  ['Email', form.email],
                  ['Address', `${form.currentAddressLine1}, ${form.currentCity}, ${form.currentState} - ${form.currentPinCode}`],
                ].map(([label, value]) => (
                  <Grid key={label} size={{ xs: 12, sm: 6 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: SLATE_500 }}>{label}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>{value || '—'}</Typography>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Employment + Loan Summary */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2, height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <SectionHeader icon={<WorkIcon />} title="Employment" />
                  {[
                    ['Type', form.employmentType],
                    ['Employer', form.employerName],
                    ['Gross Income', `₹${parseFloat(form.grossMonthlyIncome || '0').toLocaleString('en-IN')}/mo`],
                    ['Existing EMI', `₹${parseFloat(form.existingMonthlyEMI || '0').toLocaleString('en-IN')}/mo`],
                    ['CIBIL Score', form.cibilScore || 'Not provided'],
                  ].map(([label, value]) => (
                    <Stack key={label} direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography sx={{ fontSize: '0.75rem', color: SLATE_500 }}>{label}</Typography>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>{value}</Typography>
                    </Stack>
                  ))}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              {amount > 0 && <EMICard amount={amount} months={months} rate={rate} />}
            </Grid>
          </Grid>

          {/* Eligibility final check */}
          {eligibility && <EligibilityPanel result={eligibility} loading={false} />}
          {!eligibility && (
            <Alert severity="warning">
              Please go back to Step 3 to complete the eligibility check.
            </Alert>
          )}

          {/* Documents uploaded */}
          <Card sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <SectionHeader icon={<UploadFileIcon />} title="Documents" />
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {checklist.map(item => {
                  const uploaded = uploadedDocs[item.documentType];
                  return (
                    <Chip key={item.documentType}
                      label={item.documentLabel}
                      size="small"
                      icon={uploaded ? <CheckCircleIcon /> : <CancelIcon />}
                      sx={{
                        backgroundColor: uploaded ? '#F0FDF4' : '#FEF2F2',
                        color: uploaded ? '#166534' : '#991B1B',
                        '& .MuiChip-icon': { color: uploaded ? '#10B981' : '#EF4444' },
                      }}
                    />
                  );
                })}
              </Stack>
            </CardContent>
          </Card>

          {/* Declaration */}
          <Card sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <SectionHeader icon={<RuleIcon />} title="Declaration & Consent" />
              <Typography sx={{ fontSize: '0.8125rem', color: SLATE_500, mb: 2, lineHeight: 1.6 }}>
                I/We hereby declare that the information provided in this application is true, correct and complete
                to the best of my/our knowledge. I/We authorise the bank to verify the information provided and
                to obtain my/our credit information from credit bureaus. I/We have read and understood the terms
                and conditions, Key Facts Statement (KFS), and the charges applicable.
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.declarationAccepted}
                    onChange={e => setField('declarationAccepted', e.target.checked)}
                    sx={{ '&.Mui-checked': { color: BLUE_600 } }}
                  />
                }
                label={<Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  I accept the declaration and consent to the bank verifying my information
                </Typography>}
              />
              {errors.declarationAccepted && (
                <Typography sx={{ color: '#EF4444', fontSize: '0.75rem', mt: 0.5 }}>
                  {errors.declarationAccepted}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* ── Navigation Buttons ── */}
      <Stack direction="row" justifyContent="space-between" mt={3}>
        <Button
          variant="outlined" startIcon={<ArrowBackIcon />}
          onClick={handleBack} disabled={activeStep === 0}
          sx={{ borderColor: SLATE_200, color: SLATE_500 }}
        >
          Back
        </Button>
        {activeStep < STEPS.length - 1
          ? <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={handleNext}
              sx={{ backgroundColor: BLUE_600, '&:hover': { backgroundColor: '#1D4ED8' } }}>
              Continue
            </Button>
          : <Button variant="contained" endIcon={submitting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SendIcon />}
              onClick={handleSubmit} disabled={submitting}
              sx={{ backgroundColor: BLUE_600, '&:hover': { backgroundColor: '#1D4ED8' }, minWidth: 160 }}>
              {submitting ? 'Submitting...' : 'Submit Application'}
            </Button>
        }
      </Stack>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LoanOrigination;

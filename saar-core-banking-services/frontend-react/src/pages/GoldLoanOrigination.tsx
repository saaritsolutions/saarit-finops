import React, { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, FormControlLabel, Checkbox, IconButton, Stack, Step,
  StepLabel, Stepper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import DiamondIcon       from '@mui/icons-material/Diamond';
import PersonIcon        from '@mui/icons-material/Person';
import ShoppingBagIcon   from '@mui/icons-material/ShoppingBag';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import UploadFileIcon    from '@mui/icons-material/UploadFile';
import RuleIcon          from '@mui/icons-material/Rule';
import AddIcon           from '@mui/icons-material/Add';
import DeleteIcon        from '@mui/icons-material/Delete';
import ArrowBackIcon     from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon  from '@mui/icons-material/ArrowForward';
import SendIcon          from '@mui/icons-material/Send';
import CheckCircleIcon   from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon    from '@mui/icons-material/ExpandMore';
import { useNavigate }   from 'react-router-dom';
import PageHeader        from '../components/common/PageHeader';
import SchemaForm        from '../components/forms/SchemaForm';
import { dynamicFormsService } from '../services/dynamicFormsService';
import type { DFSFormSchema }   from '../services/dynamicFormsService';
import {
  getTodayGoldRate, createGoldLoanApplication, addPledgeItem,
  type GoldRateEntry, type AddPledgeItemRequest,
} from '../services/goldLoanService';

// ── Design tokens ──────────────────────────────────────────────────────────────
const BLUE_600  = '#2563EB';
const BLUE_50   = '#EFF6FF';
const SLATE_50  = '#F8FAFC';
const SLATE_200 = '#E2E8F0';
const SLATE_500 = '#64748B';
const GOLD_500  = '#EAB308';
const GOLD_BG   = '#FEF9C3';

const INR = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ── Step definitions ────────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Applicant Info',  icon: <PersonIcon        sx={{ fontSize: 16 }} /> },
  { label: 'Pledge Items',    icon: <ShoppingBagIcon   sx={{ fontSize: 16 }} /> },
  { label: 'Loan Details',    icon: <MonetizationOnIcon sx={{ fontSize: 16 }} /> },
  { label: 'Documents',       icon: <UploadFileIcon    sx={{ fontSize: 16 }} /> },
  { label: 'Review & Submit', icon: <RuleIcon          sx={{ fontSize: 16 }} /> },
];

const PURITY_OPTIONS = [18, 20, 22, 24];
const ITEM_TYPES = ['NECKLACE', 'BANGLE', 'RING', 'COIN', 'BAR', 'ANKLET', 'EARRING', 'OTHER'];
const TENURE_OPTIONS = [3, 6, 9, 12];
const INTEREST_RATE = 7.00; // Gold loan product base rate

// ── DFS integration constants ───────────────────────────────────────────────────
// Fields already collected in the hardcoded form — exclude from DFS accordion
const HARDCODED_GOLD_FIELDS = new Set([
  'fullName', 'mobileNumber', 'panNumber',
  'loanAmount', 'tenureMonths', 'purposeOfLoan',
]);
// Map DFS GOLD_LOAN schema section keys to wizard step indices
const GOLD_DFS_SECTION_TO_STEP: Record<string, number> = {
  applicant: 0,
  pledge:    1,
  loan:      2,
};

interface PledgeRow extends AddPledgeItemRequest {
  _key: number;
}

const newPledgeRow = (key: number): PledgeRow => ({
  _key: key, itemType: 'NECKLACE', description: '',
  grossWeightGrams: 0, stoneDeductionGrams: 0,
  purityCarats: 22, packetNumber: '',
});

export default function GoldLoanOrigination() {
  const navigate = useNavigate();
  const [step,      setStep]      = useState(0);
  const [todayRate, setTodayRate] = useState<GoldRateEntry | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [createdAppNo, setCreatedAppNo] = useState<string | null>(null);
  const [createdId,    setCreatedId]    = useState<string | null>(null);
  const [nextKey, setNextKey] = useState(1);

  // Step 0: Applicant
  const [form, setForm] = useState({
    applicantName: '', mobileNumber: '', email: '', panNumber: '',
    aadhaarLast4: '', addressLine1: '', city: '', state: '',
    pinCode: '', purposeOfLoan: '',
  });

  // Step 1: Pledge items
  const [pledgeRows, setPledgeRows] = useState<PledgeRow[]>([newPledgeRow(0)]);

  // Step 2: Loan details
  const [tenureMonths,    setTenureMonths]    = useState(6);
  const [requestedAmount, setRequestedAmount] = useState('');

  // Step 3: Documents (placeholder)
  const [declaration, setDeclaration] = useState(false);

  // DFS — bank-configured fields
  const [dfsSchema,    setDfsSchema]    = useState<DFSFormSchema | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, any>>({});

  // Load today's gold rate
  useEffect(() => {
    getTodayGoldRate().then(setTodayRate).catch(() => setTodayRate(null));
  }, []);

  // Load GOLD_LOAN DFS schema (fail-silent if DFS offline)
  useEffect(() => {
    dynamicFormsService.getSchema('GOLD_LOAN')
      .then(res => setDfsSchema(JSON.parse(res.schema) as DFSFormSchema))
      .catch(() => { /* DFS offline — accordion not shown */ });
  }, []);

  // ── Computed values ──────────────────────────────────────────────────────────
  const ratePerGram = todayRate?.ratePerGramFor22K ?? 0;

  const computedItems = pledgeRows.map(r => {
    const net     = Math.max(0, r.grossWeightGrams - r.stoneDeductionGrams);
    const factor  = r.purityCarats / 24;
    const valued  = net * factor * ratePerGram;
    return { ...r, netWeight: net, purityFactor: factor, valued };
  });

  const totalNetWeight = computedItems.reduce((s, r) => s + r.netWeight, 0);
  const totalValued    = computedItems.reduce((s, r) => s + r.valued, 0);
  const maxEligible    = Math.floor(totalValued * 0.75);

  const reqAmt       = parseFloat(requestedAmount) || 0;
  const ltv          = totalValued > 0 ? (reqAmt / totalValued) * 100 : 0;
  const monthlyInt   = reqAmt * INTEREST_RATE / 100 / 12;
  const totalInterest = reqAmt * INTEREST_RATE / 100 * tenureMonths / 12;
  const totalDue     = reqAmt + totalInterest;

  // Pre-fill requested amount when entering step 2
  const goToStep = (next: number) => {
    if (next === 2 && !requestedAmount && maxEligible > 0)
      setRequestedAmount(String(maxEligible));
    setStep(next);
    setError(null);
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.applicantName.trim()) return 'Applicant name is required.';
    }
    if (step === 1) {
      if (pledgeRows.length === 0) return 'At least one pledge item is required.';
      for (const r of pledgeRows) {
        if (r.grossWeightGrams <= 0) return 'Gross weight must be > 0 for all items.';
        if (r.stoneDeductionGrams < 0) return 'Stone deduction cannot be negative.';
        if (r.stoneDeductionGrams >= r.grossWeightGrams) return 'Stone deduction must be less than gross weight.';
      }
    }
    if (step === 2) {
      const amt = parseFloat(requestedAmount);
      if (isNaN(amt) || amt <= 0) return 'Requested amount must be > 0.';
      if (ltv > 75) return `LTV ${ltv.toFixed(2)}% exceeds the maximum 75%. Reduce the requested amount.`;
    }
    if (step === 4) {
      if (!declaration) return 'Please accept the declaration before submitting.';
    }
    return null;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      // 1. Create application
      const created = await createGoldLoanApplication({
        applicantName:       form.applicantName,
        mobileNumber:        form.mobileNumber || undefined,
        email:               form.email        || undefined,
        panNumber:           form.panNumber    || undefined,
        aadhaarLast4:        form.aadhaarLast4 || undefined,
        addressLine1:        form.addressLine1 || undefined,
        city:                form.city         || undefined,
        state:               form.state        || undefined,
        pinCode:             form.pinCode      || undefined,
        purposeOfLoan:       form.purposeOfLoan || undefined,
        requestedAmount:     parseFloat(requestedAmount),
        tenureMonths,
        interestRatePercent: INTEREST_RATE,
        customFieldsJson:    Object.keys(customFields).length > 0
          ? JSON.stringify(customFields)
          : undefined,
      });

      // 2. Add pledge items
      for (const r of pledgeRows) {
        await addPledgeItem(created.id, {
          itemType:            r.itemType,
          description:         r.description || undefined,
          grossWeightGrams:    r.grossWeightGrams,
          stoneDeductionGrams: r.stoneDeductionGrams,
          purityCarats:        r.purityCarats,
          packetNumber:        r.packetNumber || undefined,
        });
      }

      setCreatedAppNo(created.applicationNumber);
      setCreatedId(created.id);
      setStep(5); // success screen
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── Pledge row helpers ───────────────────────────────────────────────────────
  const updateRow = (key: number, field: keyof AddPledgeItemRequest, value: any) => {
    setPledgeRows(rows => rows.map(r => r._key === key ? { ...r, [field]: value } : r));
  };
  const removeRow = (key: number) => setPledgeRows(rows => rows.filter(r => r._key !== key));
  const addRow    = () => {
    setPledgeRows(rows => [...rows, newPledgeRow(nextKey)]);
    setNextKey(k => k + 1);
  };

  // ── DFS Bank-Configured Fields accordion ────────────────────────────────────
  const BankConfiguredFields = ({ stepIndex }: { stepIndex: number }) => {
    if (!dfsSchema) return null;
    const fields = dfsSchema.fields.filter(f =>
      !HARDCODED_GOLD_FIELDS.has(f.name) &&
      GOLD_DFS_SECTION_TO_STEP[f.section ?? ''] === stepIndex
    );
    if (fields.length === 0) return null;
    return (
      <Accordion sx={{ mt: 2, border: '1px dashed', borderColor: 'divider' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" color="text.secondary">
            Bank-Configured Fields ({fields.length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <SchemaForm
            schema={{ ...dfsSchema, fields, sections: [] }}
            values={customFields}
            onChange={(name, value) =>
              setCustomFields(prev => ({ ...prev, [name]: value }))
            }
          />
        </AccordionDetails>
      </Accordion>
    );
  };

  // ── Success screen ───────────────────────────────────────────────────────────
  if (step === 5) {
    return (
      <Box sx={{ p: 3, maxWidth: 600, mx: 'auto', textAlign: 'center', mt: 8 }}>
        <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
        <Typography variant="h4" fontWeight={700} mb={1}>Application Submitted!</Typography>
        <Typography variant="h5" color={BLUE_600} fontWeight={600} mb={2}>
          {createdAppNo}
        </Typography>
        <Typography color="text.secondary" mb={4}>
          Your gold loan application has been created in DRAFT status.
          The next step is appraisal by a field officer.
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="outlined" onClick={() => navigate('/gold-loans')}>
            View All Gold Loans
          </Button>
          <Button variant="contained" sx={{ bgcolor: BLUE_600 }}
            onClick={() => createdId && navigate(`/gold-loans/${createdId}`)}>
            View Application
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <PageHeader
        title="New Gold Loan Application"
        subtitle="Pledge gold ornaments and get instant funds — same-day disbursal."
        icon={<DiamondIcon sx={{ color: GOLD_500, fontSize: 28 }} />}
      />

      {/* ── Stepper ── */}
      <Stepper activeStep={step} sx={{ mb: 4 }} alternativeLabel>
        {STEPS.map(s => (
          <Step key={s.label}><StepLabel>{s.label}</StepLabel></Step>
        ))}
      </Stepper>

      {/* Today's rate chip */}
      {todayRate && (
        <Chip
          icon={<DiamondIcon />}
          label={`Today's Gold Rate: ${INR(todayRate.ratePerGramFor22K)} / gram (22K)`}
          sx={{ mb: 2, bgcolor: GOLD_BG, border: `1px solid ${GOLD_500}44`, fontWeight: 600 }}
        />
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Step content ── */}
      <Card>
        <CardContent>

          {/* STEP 0 — Applicant Info */}
          {step === 0 && (
            <Box>
              <Typography variant="h6" fontWeight={600} mb={2}>Applicant Information</Typography>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField fullWidth label="Full Name *" value={form.applicantName}
                    onChange={e => setForm(f => ({ ...f, applicantName: e.target.value }))} />
                  <TextField fullWidth label="Mobile Number" value={form.mobileNumber}
                    onChange={e => setForm(f => ({ ...f, mobileNumber: e.target.value }))} />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField fullWidth label="Email" type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  <TextField fullWidth label="PAN (ABCDE1234F)" value={form.panNumber}
                    onChange={e => setForm(f => ({ ...f, panNumber: e.target.value.toUpperCase() }))}
                    inputProps={{ maxLength: 10 }} />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField fullWidth label="Aadhaar Last 4 digits" value={form.aadhaarLast4}
                    onChange={e => setForm(f => ({ ...f, aadhaarLast4: e.target.value.replace(/\D/g,'').slice(0,4) }))} />
                  <TextField fullWidth label="Purpose of Loan" value={form.purposeOfLoan}
                    onChange={e => setForm(f => ({ ...f, purposeOfLoan: e.target.value }))} />
                </Stack>
                <Divider><Typography variant="caption" color="text.secondary">Address</Typography></Divider>
                <TextField fullWidth label="Street Address" value={form.addressLine1}
                  onChange={e => setForm(f => ({ ...f, addressLine1: e.target.value }))} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField fullWidth label="City" value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                  <TextField fullWidth label="State" value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                  <TextField fullWidth label="PIN Code" value={form.pinCode}
                    onChange={e => setForm(f => ({ ...f, pinCode: e.target.value.replace(/\D/g,'').slice(0,6) }))} />
                </Stack>
              </Stack>
              <BankConfiguredFields stepIndex={0} />
            </Box>
          )}

          {/* STEP 1 — Pledge Items */}
          {step === 1 && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>Pledge Items</Typography>
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addRow}>
                  Add Item
                </Button>
              </Stack>

              {!ratePerGram && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No gold rate available. Valued amounts will be ₹0 until a rate is entered.
                </Alert>
              )}

              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: SLATE_50 }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Gross Wt (g)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Stone Ded (g)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Net Wt (g)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Purity (K)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Value (₹)</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Packet #</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {computedItems.map((row, idx) => (
                      <TableRow key={row._key}>
                        <TableCell>
                          <TextField select size="small" value={row.itemType}
                            onChange={e => updateRow(row._key, 'itemType', e.target.value)}
                            SelectProps={{ native: true }} sx={{ minWidth: 110 }}>
                            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </TextField>
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="number" value={row.grossWeightGrams || ''}
                            onChange={e => updateRow(row._key, 'grossWeightGrams', parseFloat(e.target.value) || 0)}
                            inputProps={{ min: 0, step: '0.001' }} sx={{ width: 90 }} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="number" value={row.stoneDeductionGrams || ''}
                            onChange={e => updateRow(row._key, 'stoneDeductionGrams', parseFloat(e.target.value) || 0)}
                            inputProps={{ min: 0, step: '0.001' }} sx={{ width: 90 }} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500 }}>
                          {row.netWeight.toFixed(3)}
                        </TableCell>
                        <TableCell>
                          <TextField select size="small" value={row.purityCarats}
                            onChange={e => updateRow(row._key, 'purityCarats', parseInt(e.target.value))}
                            SelectProps={{ native: true }} sx={{ width: 70 }}>
                            {PURITY_OPTIONS.map(p => <option key={p} value={p}>{p}K</option>)}
                          </TextField>
                        </TableCell>
                        <TableCell align="right" sx={{ color: GOLD_500, fontWeight: 600 }}>
                          {INR(row.valued)}
                        </TableCell>
                        <TableCell>
                          <TextField size="small" value={row.packetNumber || ''}
                            onChange={e => updateRow(row._key, 'packetNumber', e.target.value)}
                            placeholder="P-001" sx={{ width: 80 }} />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Remove">
                            <IconButton size="small" color="error"
                              onClick={() => removeRow(row._key)}
                              disabled={pledgeRows.length === 1}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Totals */}
              <Box sx={{ mt: 2, p: 2, bgcolor: GOLD_BG, borderRadius: 1, border: `1px solid ${GOLD_500}44` }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Total Net Weight</Typography>
                    <Typography fontWeight={700}>{totalNetWeight.toFixed(3)} g</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Total Valued Amount</Typography>
                    <Typography fontWeight={700} color={GOLD_500}>{INR(totalValued)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Max Eligible (75% LTV)</Typography>
                    <Typography fontWeight={700} color={BLUE_600}>{INR(maxEligible)}</Typography>
                  </Box>
                </Stack>
              </Box>
              <BankConfiguredFields stepIndex={1} />
            </Box>
          )}

          {/* STEP 2 — Loan Details */}
          {step === 2 && (
            <Box>
              <Typography variant="h6" fontWeight={600} mb={2}>Loan Details</Typography>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Repayment Scheme</Typography>
                  <Box><Chip label="BULLET" color="primary" /></Box>
                  <Typography variant="caption" color="text.secondary" mt={0.5}>
                    Full principal + interest repaid at maturity (Phase 1 only)
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" fontWeight={600} mb={1}>Tenure</Typography>
                  <Stack direction="row" spacing={1}>
                    {TENURE_OPTIONS.map(m => (
                      <Chip key={m} label={`${m}M`} variant={tenureMonths === m ? 'filled' : 'outlined'}
                        color={tenureMonths === m ? 'primary' : 'default'}
                        onClick={() => setTenureMonths(m)} sx={{ cursor: 'pointer', fontWeight: 600 }} />
                    ))}
                  </Stack>
                </Box>

                <TextField
                  label="Requested Amount (₹)"
                  type="number"
                  value={requestedAmount}
                  onChange={e => setRequestedAmount(e.target.value)}
                  helperText={`Max eligible: ${INR(maxEligible)}`}
                  inputProps={{ min: 1, max: maxEligible }}
                  sx={{ maxWidth: 280 }}
                />

                {/* Live preview */}
                {reqAmt > 0 && (
                  <Box sx={{ p: 2, bgcolor: BLUE_50, borderRadius: 1, border: `1px solid ${BLUE_600}33` }}>
                    <Typography variant="subtitle2" fontWeight={600} mb={1}>Loan Preview</Typography>
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
                        <Typography variant="body2" fontWeight={600}>{INTEREST_RATE}% p.a.</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Monthly Interest</Typography>
                        <Typography variant="body2">{INR(monthlyInt)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Total Interest ({tenureMonths}M)</Typography>
                        <Typography variant="body2">{INR(totalInterest)}</Typography>
                      </Stack>
                      <Divider />
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={600}>Total Due at Maturity</Typography>
                        <Typography variant="body2" fontWeight={700} color={BLUE_600}>{INR(totalDue)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">LTV</Typography>
                        <Typography variant="body2" fontWeight={600}
                          color={ltv > 75 ? 'error.main' : ltv > 70 ? 'warning.main' : 'success.main'}>
                          {ltv.toFixed(2)}%
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                )}
              </Stack>
              <BankConfiguredFields stepIndex={2} />
            </Box>
          )}

          {/* STEP 3 — Documents */}
          {step === 3 && (
            <Box>
              <Typography variant="h6" fontWeight={600} mb={2}>Documents</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Document upload will be available after application creation. You can upload KYC documents
                (PAN, Aadhaar, photo) from the application detail page.
              </Alert>
              <Stack spacing={1}>
                {['PAN Card (mandatory)', 'Aadhaar Card (mandatory)', 'Photograph (mandatory)', 'GOLD_RECEIPT (optional)'].map(d => (
                  <Stack key={d} direction="row" spacing={1} alignItems="center">
                    <Chip label={d.includes('mandatory') ? 'REQUIRED' : 'OPTIONAL'}
                      color={d.includes('mandatory') ? 'error' : 'default'} size="small" />
                    <Typography variant="body2">{d.split(' (')[0]}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {/* STEP 4 — Review & Submit */}
          {step === 4 && (
            <Box>
              <Typography variant="h6" fontWeight={600} mb={2}>Review & Submit</Typography>

              <Stack spacing={2}>
                {/* Applicant summary */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" mb={1}>APPLICANT</Typography>
                    <Stack direction="row" spacing={4}>
                      <Box>
                        <Typography fontWeight={600}>{form.applicantName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {form.mobileNumber}{form.panNumber && ` · ${form.panNumber}`}
                        </Typography>
                      </Box>
                      {form.city && (
                        <Box>
                          <Typography variant="body2">{form.city}{form.state && `, ${form.state}`}</Typography>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Pledge summary */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" mb={1}>PLEDGE ITEMS</Typography>
                    <Stack direction="row" spacing={4}>
                      <Box>
                        <Typography fontWeight={600}>{pledgeRows.length} item(s)</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Net Weight: {totalNetWeight.toFixed(3)} g
                        </Typography>
                      </Box>
                      <Box>
                        <Typography fontWeight={600} color={GOLD_500}>{INR(totalValued)}</Typography>
                        <Typography variant="body2" color="text.secondary">Total Valued Amount</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Loan summary */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" mb={1}>LOAN TERMS</Typography>
                    <Stack direction="row" spacing={4} flexWrap="wrap">
                      <Box>
                        <Typography variant="body2" color="text.secondary">Scheme</Typography>
                        <Typography fontWeight={600}>BULLET</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Tenure</Typography>
                        <Typography fontWeight={600}>{tenureMonths} months</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Amount</Typography>
                        <Typography fontWeight={600} color={BLUE_600}>{INR(reqAmt)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Rate</Typography>
                        <Typography fontWeight={600}>{INTEREST_RATE}% p.a.</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Total Due</Typography>
                        <Typography fontWeight={600}>{INR(totalDue)}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Bank-Configured Fields summary */}
                {Object.keys(customFields).filter(k => customFields[k] !== '' && customFields[k] !== undefined).length > 0 && (
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" mb={1}>BANK-CONFIGURED FIELDS</Typography>
                      {dfsSchema?.fields
                        .filter(f => customFields[f.name] !== undefined && customFields[f.name] !== '')
                        .map(f => (
                          <Box key={f.name} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                            <Typography variant="body2" color="text.secondary">{f.label}</Typography>
                            <Typography variant="body2" fontWeight={500}>{String(customFields[f.name])}</Typography>
                          </Box>
                        ))}
                    </CardContent>
                  </Card>
                )}

                <FormControlLabel
                  control={<Checkbox checked={declaration} onChange={e => setDeclaration(e.target.checked)} />}
                  label="I confirm that the above details are correct and the gold ornaments are my own property. I agree to the terms and conditions of this gold loan."
                />
              </Stack>
            </Box>
          )}

        </CardContent>
      </Card>

      {/* ── Navigation buttons ── */}
      <Stack direction="row" justifyContent="space-between" mt={2}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => step === 0 ? navigate('/gold-loans') : setStep(s => s - 1)}
          variant="outlined"
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>

        {step < 4 ? (
          <Button
            endIcon={<ArrowForwardIcon />}
            variant="contained"
            sx={{ bgcolor: BLUE_600, '&:hover': { bgcolor: '#1D4ED8' } }}
            onClick={() => {
              const err = validateStep();
              if (err) { setError(err); return; }
              goToStep(step + 1);
            }}
          >
            Next
          </Button>
        ) : (
          <Button
            endIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            variant="contained"
            disabled={loading}
            sx={{ bgcolor: BLUE_600, '&:hover': { bgcolor: '#1D4ED8' } }}
            onClick={() => {
              const err = validateStep();
              if (err) { setError(err); return; }
              handleSubmit();
            }}
          >
            {loading ? 'Submitting…' : 'Submit Application'}
          </Button>
        )}
      </Stack>
    </Box>
  );
}

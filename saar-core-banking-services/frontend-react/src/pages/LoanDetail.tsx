import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  Grid, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Timeline, TimelineConnector, TimelineContent, TimelineDot,
  TimelineItem, TimelineSeparator,
} from '@mui/lab';
import CheckCircleIcon   from '@mui/icons-material/CheckCircle';
import CancelIcon        from '@mui/icons-material/Cancel';
import HourglassIcon     from '@mui/icons-material/HourglassBottom';
import ThumbUpIcon       from '@mui/icons-material/ThumbUp';
import GavelIcon         from '@mui/icons-material/Gavel';
import InfoIcon          from '@mui/icons-material/Info';
import PaymentsIcon      from '@mui/icons-material/Payments';
import ArrowBackIcon     from '@mui/icons-material/ArrowBack';
import RefreshIcon       from '@mui/icons-material/Refresh';
import PersonIcon        from '@mui/icons-material/Person';
import WorkIcon          from '@mui/icons-material/Work';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import DescriptionIcon   from '@mui/icons-material/Description';
import CalculateIcon     from '@mui/icons-material/Calculate';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getApplicationDetail, takeApplicationAction,
  type ApplicationDetail, type ApprovalAction,
} from '../services/loanOriginationService';
import JournalDetailDialog from '../components/dialogs/JournalDetailDialog';

// ── Design tokens ──────────────────────────────────────────────────────────────
const BLUE_600  = '#2563EB';
const BLUE_50   = '#EFF6FF';
const SLATE_50  = '#F8FAFC';
const SLATE_200 = '#E2E8F0';
const SLATE_500 = '#64748B';
const SLATE_900 = '#0F172A';

// ── Helpers ────────────────────────────────────────────────────────────────────
const INR = (n?: number | null) =>
  n != null ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}` : '—';

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const fmtDateOnly = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'long' });
};

const n2s = (v: any) => (v !== null && v !== undefined && v !== '') ? String(v) : '—';

// ── Amortization ───────────────────────────────────────────────────────────────
type AmortRow = { month: number; opening: number; emi: number; principal: number; interest: number; closing: number };

function computeAmortization(principal: number, annualRate: number, months: number): { emi: number; rows: AmortRow[] } {
  const r = annualRate / 12 / 100;
  const emi = r === 0
    ? principal / months
    : (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  const rows: AmortRow[] = [];
  let balance = principal;
  for (let i = 1; i <= months; i++) {
    const interest = balance * r;
    const principalPart = emi - interest;
    const closing = Math.max(0, balance - principalPart);
    rows.push({ month: i, opening: balance, emi, principal: principalPart, interest, closing });
    balance = closing;
  }
  return { emi, rows };
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'error' | 'primary' }> = {
  DRAFT:          { label: 'Draft',           color: 'default' },
  SUBMITTED:      { label: 'Submitted',       color: 'warning' },
  IN_REVIEW:      { label: 'In Review',       color: 'info'    },
  INFO_REQUESTED: { label: 'Info Requested',  color: 'warning' },
  CREDIT_APPROVED:{ label: 'Credit Approved', color: 'primary' },
  APPROVED:       { label: 'Sanctioned',      color: 'success' },
  REJECTED:       { label: 'Rejected',        color: 'error'   },
  DISBURSED:      { label: 'Disbursed',       color: 'success' },
};

// ── Action config ──────────────────────────────────────────────────────────────
type ActionDef = { label: string; action: string; color: 'success' | 'error' | 'primary' | 'info' | 'warning'; needsComment?: boolean; confirmTitle: string };

const ACTIONS_BY_STATUS: Record<string, ActionDef[]> = {
  SUBMITTED:      [
    { label: 'Send to Review',    action: 'SEND_TO_REVIEW',  color: 'info',    confirmTitle: 'Send to Credit Review?' },
    { label: 'Credit Approve',    action: 'CREDIT_APPROVE',  color: 'success', confirmTitle: 'Approve at Credit Stage?' },
    { label: 'Reject',            action: 'REJECT',          color: 'error',   needsComment: true, confirmTitle: 'Reject Application?' },
    { label: 'Request More Info', action: 'REQUEST_INFO',    color: 'warning', needsComment: true, confirmTitle: 'Request Additional Information?' },
  ],
  IN_REVIEW:      [
    { label: 'Credit Approve',    action: 'CREDIT_APPROVE',  color: 'success', confirmTitle: 'Approve at Credit Stage?' },
    { label: 'Reject',            action: 'REJECT',          color: 'error',   needsComment: true, confirmTitle: 'Reject Application?' },
    { label: 'Request More Info', action: 'REQUEST_INFO',    color: 'warning', needsComment: true, confirmTitle: 'Request Additional Information?' },
  ],
  CREDIT_APPROVED:[
    { label: 'Sanction Loan',     action: 'SANCTION',        color: 'success', needsComment: true, confirmTitle: 'Sanction / Final Approve?' },
    { label: 'Reject',            action: 'REJECT',          color: 'error',   needsComment: true, confirmTitle: 'Reject Application?' },
  ],
  APPROVED:       [
    { label: 'Disburse Loan',     action: 'DISBURSE',        color: 'primary', confirmTitle: 'Mark as Disbursed?' },
  ],
  INFO_REQUESTED: [
    { label: 'Send to Review',    action: 'SEND_TO_REVIEW',  color: 'info',    confirmTitle: 'Return to Credit Review?' },
  ],
};

// ── Action timeline dot config ─────────────────────────────────────────────────
const actionDotConfig = (action: string): { color: 'success' | 'error' | 'info' | 'warning' | 'primary' | 'grey'; icon: React.ReactElement } => {
  switch (action) {
    case 'CREDIT_APPROVE': return { color: 'primary', icon: <ThumbUpIcon sx={{ fontSize: 14 }} /> };
    case 'SANCTION':       return { color: 'success', icon: <GavelIcon   sx={{ fontSize: 14 }} /> };
    case 'REJECT':         return { color: 'error',   icon: <CancelIcon  sx={{ fontSize: 14 }} /> };
    case 'REQUEST_INFO':   return { color: 'warning', icon: <InfoIcon    sx={{ fontSize: 14 }} /> };
    case 'DISBURSE':       return { color: 'success', icon: <PaymentsIcon sx={{ fontSize: 14 }} /> };
    case 'SEND_TO_REVIEW': return { color: 'info',    icon: <HourglassIcon sx={{ fontSize: 14 }} /> };
    default:               return { color: 'grey',    icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> };
  }
};

// ── Info Row ──────────────────────────────────────────────────────────────────
const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8, borderBottom: `1px solid ${SLATE_200}` }}>
    <Typography variant="body2" color={SLATE_500} sx={{ minWidth: 140 }}>{label}</Typography>
    <Typography variant="body2" fontWeight={500} textAlign="right">{value ?? '—'}</Typography>
  </Box>
);

// ── Section Card ───────────────────────────────────────────────────────────────
const SectionCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <Card sx={{ border: `1px solid ${SLATE_200}`, boxShadow: 'none', borderRadius: 2, height: '100%' }}>
    <CardContent sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
        <Box sx={{ color: BLUE_600, display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle2" fontWeight={700} color={SLATE_900}>{title}</Typography>
      </Stack>
      <Divider sx={{ mb: 1.5 }} />
      {children}
    </CardContent>
  </Card>
);

// ── Action Dialog ──────────────────────────────────────────────────────────────
interface ActionDialogProps {
  open: boolean;
  def: ActionDef | null;
  onClose: () => void;
  onConfirm: (comments: string) => void;
  loading: boolean;
}

const ActionDialog: React.FC<ActionDialogProps> = ({ open, def, onClose, onConfirm, loading }) => {
  const [comments, setComments] = useState('');
  useEffect(() => { if (!open) setComments(''); }, [open]);
  if (!def) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{def.confirmTitle}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={def.needsComment ? 2 : 0}>
          {def.action === 'REJECT'
            ? 'Please provide a reason for rejection. This will be visible to the applicant.'
            : def.action === 'SANCTION'
            ? 'Confirm sanction and add any remarks for the file.'
            : def.action === 'REQUEST_INFO'
            ? 'Describe the additional information or documents required.'
            : `Confirm that you want to: ${def.label}`}
        </Typography>
        {def.needsComment && (
          <TextField
            label={def.action === 'REJECT' ? 'Rejection Reason *' : 'Remarks'}
            fullWidth multiline rows={3}
            value={comments}
            onChange={e => setComments(e.target.value)}
            required={def.action === 'REJECT'}
            placeholder={def.action === 'REJECT' ? 'e.g. CIBIL score below threshold...' : 'Optional remarks...'}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderColor: SLATE_200 }}>Cancel</Button>
        <Button
          variant="contained"
          color={def.color}
          onClick={() => onConfirm(comments)}
          disabled={loading || (def.action === 'REJECT' && !comments.trim())}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : def.label}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const LoanDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail]       = useState<ApplicationDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [actionDef, setActionDef] = useState<ActionDef | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [journalDialogOpen, setJournalDialogOpen] = useState(false);

  const app = detail?.application ?? null;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await getApplicationDetail(id);
      setDetail(d);
    } catch {
      setError('Failed to load application. Ensure LoanService is running.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (comments: string) => {
    if (!id || !actionDef) return;
    setActionLoading(true);
    try {
      const updated = await takeApplicationAction(id, {
        action:    actionDef.action,
        actionBy:  'admin',
        role:      actionDef.action === 'SANCTION' ? 'MANAGER' : 'CREDIT_OFFICER',
        comments:  comments || undefined,
      });
      setDetail(updated);
      setSuccessMsg(`Action "${actionDef.label}" completed successfully.`);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Action failed. Please try again.');
    } finally {
      setActionLoading(false);
      setActionDef(null);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !app) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/loans')} sx={{ mb: 2 }}>
          Back to Loans
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const status     = app?.status ?? '';
  const statusCfg  = STATUS_CONFIG[status] ?? { label: status, color: 'default' as const };
  const availActions = ACTIONS_BY_STATUS[status] ?? [];

  // Normalise field access (C# PascalCase or camelCase)
  const f = (camel: string, pascal?: string) => app?.[camel] ?? app?.[pascal ?? camel[0].toUpperCase() + camel.slice(1)] ?? null;

  return (
    <Box>
      {/* Back + Header */}
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/loans')} variant="text" sx={{ color: SLATE_500 }}>
          Loan Applications
        </Button>
      </Stack>

      {/* Title row */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} mb={3}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
            <Typography variant="h5" fontWeight={700} color={SLATE_900}>
              {f('applicationNumber') || 'Loan Application'}
            </Typography>
            <Chip label={statusCfg.label} color={statusCfg.color} sx={{ fontWeight: 700 }} />
          </Stack>
          <Typography variant="body2" color={SLATE_500}>
            {f('applicantName')} · {f('productType')} · Applied {fmtDate(f('createdAt'))}
          </Typography>
        </Box>

        {/* Action Buttons */}
        {availActions.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {availActions.map(a => (
              <Button
                key={a.action}
                variant={a.color === 'error' ? 'outlined' : 'contained'}
                color={a.color}
                size="small"
                onClick={() => setActionDef(a)}
                sx={{ fontWeight: 600 }}
              >
                {a.label}
              </Button>
            ))}
          </Stack>
        )}
      </Stack>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      {/* KPI summary bar */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Requested Amount', value: INR(f('requestedAmount')), color: BLUE_600 },
          { label: 'Sanctioned Amount', value: INR(f('sanctionedAmount')), color: '#10B981' },
          { label: 'Interest Rate', value: f('interestRate') ? `${f('interestRate')}% p.a.` : '—', color: SLATE_900 },
          { label: 'Tenure', value: f('tenureMonths') ? `${f('tenureMonths')} months` : '—', color: SLATE_900 },
          { label: 'CIBIL Score', value: f('cibilScore') ?? '—', color: (f('cibilScore') ?? 0) >= 750 ? '#10B981' : '#F59E0B' },
          { label: 'FOIR', value: f('foirPercent') != null ? `${Number(f('foirPercent')).toFixed(1)}%` : '—', color: (f('foirPercent') ?? 0) > 50 ? '#EF4444' : '#10B981' },
        ].map(({ label, value, color }) => (
          <Card key={label} sx={{ border: `1px solid ${SLATE_200}`, boxShadow: 'none', borderRadius: 2, flex: '1 1 150px', minWidth: 130 }}>
            <CardContent sx={{ p: '12px 16px !important' }}>
              <Typography variant="caption" color={SLATE_500}>{label}</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color, lineHeight: 1.3 }}>{value}</Typography>
            </CardContent>
          </Card>
        ))}
        <Tooltip title="Refresh">
          <Button variant="outlined" size="small" sx={{ borderColor: SLATE_200, alignSelf: 'center' }} onClick={load}>
            <RefreshIcon fontSize="small" />
          </Button>
        </Tooltip>
      </Box>

      {/* Main grid */}
      <Grid container spacing={2} mb={2}>
        {/* Applicant Details */}
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard icon={<PersonIcon />} title="Applicant Details">
            <InfoRow label="Full Name"      value={n2s(f('applicantName'))} />
            <InfoRow label="Date of Birth"  value={fmtDateOnly(f('dateOfBirth'))} />
            <InfoRow label="Gender"         value={n2s(f('gender'))} />
            <InfoRow label="Marital Status" value={n2s(f('maritalStatus'))} />
            <InfoRow label="PAN"            value={f('panNumber') ? <Typography sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{f('panNumber')}</Typography> : '—'} />
            <InfoRow label="Aadhaar"        value={f('aadhaarLast4') ? `XXXX-XXXX-XX${f('aadhaarLast4')}` : '—'} />
            <InfoRow label="Mobile"         value={n2s(f('mobileNumber'))} />
            <InfoRow label="Email"          value={n2s(f('email'))} />
            <InfoRow label="Residence"      value={n2s(f('residenceType'))} />
            <Box mt={1.5}>
              <Typography variant="caption" color={SLATE_500} display="block" mb={0.5}>Current Address</Typography>
              <Typography variant="body2" fontWeight={500}>
                {[f('currentAddressLine1'), f('currentAddressLine2'), f('currentCity'), f('currentState'), f('currentPinCode')]
                  .filter(Boolean).join(', ') || '—'}
              </Typography>
            </Box>
          </SectionCard>
        </Grid>

        {/* Employment & Financial */}
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard icon={<WorkIcon />} title="Employment & Financials">
            <InfoRow label="Employment"     value={n2s(f('employmentType'))} />
            <InfoRow label="Employer"       value={n2s(f('employerName'))} />
            <InfoRow label="Designation"    value={n2s(f('designation'))} />
            <InfoRow label="Years at Job"   value={f('yearsAtCurrentJob') != null ? `${f('yearsAtCurrentJob')} yrs` : '—'} />
            <Divider sx={{ my: 1 }} />
            <InfoRow label="Gross Monthly Income" value={INR(f('grossMonthlyIncome'))} />
            <InfoRow label="Net Monthly Income"   value={INR(f('netMonthlyIncome'))} />
            <InfoRow label="Other Income"         value={INR(f('otherMonthlyIncome'))} />
            <InfoRow label="Existing EMI"         value={INR(f('existingMonthlyEMI'))} />
            <InfoRow label="Monthly Obligations"  value={INR(f('monthlyObligations'))} />
            {f('hasCoApplicant') && (
              <Alert severity="info" sx={{ mt: 1.5, py: 0.5, fontSize: '0.78rem' }}>
                Co-applicant included in this application
              </Alert>
            )}
          </SectionCard>
        </Grid>

        {/* Loan Parameters */}
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard icon={<MonetizationOnIcon />} title="Loan Parameters">
            <InfoRow label="Product Type"     value={n2s(f('productType'))} />
            <InfoRow label="Requested Amount" value={INR(f('requestedAmount'))} />
            <InfoRow label="Sanctioned Amount"value={INR(f('sanctionedAmount'))} />
            <InfoRow label="Tenure"           value={f('tenureMonths') ? `${f('tenureMonths')} months` : '—'} />
            <InfoRow label="Interest Rate"    value={f('interestRate') ? `${f('interestRate')}% p.a.` : '—'} />
            <InfoRow label="Purpose"          value={n2s(f('purposeOfLoan'))} />
            <Divider sx={{ my: 1 }} />
            <InfoRow label="CIBIL Score"      value={
              <Typography sx={{ fontWeight: 700, color: (f('cibilScore') ?? 0) >= 750 ? '#10B981' : '#F59E0B' }}>
                {f('cibilScore') ?? '—'}
              </Typography>
            } />
            <InfoRow label="CIBIL Band"       value={n2s(f('cibilBand'))} />
            <InfoRow label="FOIR"             value={f('foirPercent') != null ? `${Number(f('foirPercent')).toFixed(1)}%` : '—'} />
            <InfoRow label="LTV"              value={f('ltvPercent') != null ? `${Number(f('ltvPercent')).toFixed(1)}%` : '—'} />
            {f('collateralType') && (
              <>
                <Divider sx={{ my: 1 }} />
                <InfoRow label="Collateral Type"  value={n2s(f('collateralType'))} />
                <InfoRow label="Collateral Value" value={INR(f('collateralValue'))} />
              </>
            )}
            {f('disbursalJournalNumber') && (
              <>
                <Divider sx={{ my: 1 }} />
                <InfoRow
                  label="GL Journal #"
                  value={
                    <Tooltip title="Click to view GL journal entries">
                      <Chip
                        icon={<PaymentsIcon sx={{ fontSize: '0.85rem !important' }} />}
                        label={f('disbursalJournalNumber')}
                        size="small"
                        onClick={() => setJournalDialogOpen(true)}
                        sx={{
                          fontFamily: 'ui-monospace,monospace',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          backgroundColor: '#ECFDF5',
                          color: '#059669',
                          border: '1px solid #10B98130',
                          height: 22,
                          cursor: 'pointer',
                          '& .MuiChip-icon': { color: '#059669' },
                          '&:hover': { backgroundColor: '#D1FAE5' },
                        }}
                      />
                    </Tooltip>
                  }
                />
                <InfoRow label="Disbursed On" value={fmtDate(f('disbursedAt'))} />
              </>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      {/* Documents + Timeline */}
      <Grid container spacing={2}>
        {/* Documents */}
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard icon={<DescriptionIcon />} title={`Documents (${detail?.documents?.length ?? 0})`}>
            {(!detail?.documents || detail.documents.length === 0) ? (
              <Typography variant="body2" color="text.secondary" py={2} textAlign="center">
                No documents on record
              </Typography>
            ) : (
              <Stack spacing={1}>
                {detail.documents.map((doc: any, i: number) => {
                  const uploaded = doc.isUploaded ?? doc.IsUploaded;
                  const verified = doc.isVerified ?? doc.IsVerified;
                  const docType  = doc.documentType ?? doc.DocumentType ?? `Document ${i+1}`;
                  const status   = doc.status ?? doc.Status ?? 'PENDING';
                  return (
                    <Box key={doc.id ?? i} sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      p: 1.5, borderRadius: 1.5,
                      border: `1px solid ${SLATE_200}`,
                      bgcolor: verified ? '#F0FDF4' : uploaded ? BLUE_50 : SLATE_50,
                    }}>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{docType.replace(/_/g, ' ')}</Typography>
                        {doc.fileName ?? doc.FileName ? (
                          <Typography variant="caption" color={SLATE_500}>{doc.fileName ?? doc.FileName}</Typography>
                        ) : null}
                      </Box>
                      <Chip
                        size="small"
                        label={verified ? 'Verified' : uploaded ? 'Uploaded' : 'Pending'}
                        color={verified ? 'success' : uploaded ? 'primary' : 'default'}
                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                      />
                    </Box>
                  );
                })}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        {/* Approval Timeline */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ border: `1px solid ${SLATE_200}`, boxShadow: 'none', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                <Box sx={{ color: BLUE_600, display: 'flex' }}><CheckCircleIcon /></Box>
                <Typography variant="subtitle2" fontWeight={700} color={SLATE_900}>
                  Approval Timeline ({detail?.actions?.length ?? 0} events)
                </Typography>
              </Stack>
              <Divider sx={{ mb: 1 }} />

              {(!detail?.actions || detail.actions.length === 0) ? (
                <Box py={3} textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    No approval actions yet — application is awaiting review.
                  </Typography>
                </Box>
              ) : (
                <Timeline sx={{ p: 0, m: 0 }}>
                  {detail.actions.map((a: ApprovalAction, i: number) => {
                    const dot = actionDotConfig(a.action ?? '');
                    return (
                      <TimelineItem key={a.id ?? i} sx={{ '&:before': { display: 'none' }, minHeight: 56 }}>
                        <TimelineSeparator>
                          <TimelineDot color={dot.color} variant="filled" sx={{ p: 0.6, m: 0 }}>
                            {dot.icon}
                          </TimelineDot>
                          {i < (detail.actions?.length ?? 0) - 1 && <TimelineConnector />}
                        </TimelineSeparator>
                        <TimelineContent sx={{ pt: 0, pb: 1.5, pl: 1.5 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {(a.action ?? '').replace(/_/g, ' ')}
                              </Typography>
                              <Typography variant="caption" color={SLATE_500}>
                                {a.actionBy} · {a.role} ·{' '}
                                <Typography component="span" variant="caption" sx={{ color: '#64748B', fontStyle: 'italic' }}>
                                  {a.fromStatus} → {a.toStatus}
                                </Typography>
                              </Typography>
                              {a.comments && (
                                <Typography variant="caption" display="block" color="text.secondary" mt={0.3}>
                                  "{a.comments}"
                                </Typography>
                              )}
                            </Box>
                            <Typography variant="caption" color={SLATE_500} whiteSpace="nowrap" ml={1}>
                              {fmtDate(a.actionAt)}
                            </Typography>
                          </Stack>
                        </TimelineContent>
                      </TimelineItem>
                    );
                  })}
                </Timeline>
              )}

              {/* Rejection / Sanction remarks */}
              {f('rejectionReason') && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  <Typography variant="body2"><strong>Rejection reason:</strong> {f('rejectionReason')}</Typography>
                </Alert>
              )}
              {f('sanctionRemarks') && (
                <Alert severity="success" sx={{ mt: 1.5 }}>
                  <Typography variant="body2"><strong>Sanction remarks:</strong> {f('sanctionRemarks')}</Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Repayment Schedule */}
      {(() => {
        const principal = Number(f('sanctionedAmount') || f('requestedAmount'));
        const rate      = Number(f('interestRate'));
        const months    = Number(f('tenureMonths'));
        if (!principal || !rate || !months) return null;
        const { emi, rows } = computeAmortization(principal, rate, months);
        const totalInterest = rows.reduce((sum, r) => sum + r.interest, 0);
        return (
          <Box mt={2}>
            <Card sx={{ border: `1px solid ${SLATE_200}`, boxShadow: 'none', borderRadius: 2 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ color: BLUE_600, display: 'flex' }}><CalculateIcon /></Box>
                    <Typography variant="subtitle2" fontWeight={700} color={SLATE_900}>Repayment Schedule</Typography>
                  </Stack>
                  <Button
                    size="small" variant="outlined"
                    sx={{ borderColor: SLATE_200 }}
                    onClick={() => setShowSchedule(s => !s)}
                  >
                    {showSchedule ? 'Hide Table' : 'Show Month-by-Month'}
                  </Button>
                </Stack>
                <Divider sx={{ mb: 1.5 }} />

                {/* Summary KPIs */}
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: showSchedule ? 2 : 0 }}>
                  {[
                    { label: 'Monthly EMI',    value: INR(Math.round(emi)),                      color: BLUE_600   },
                    { label: 'Total Interest', value: INR(Math.round(totalInterest)),             color: '#F59E0B'  },
                    { label: 'Total Payable',  value: INR(Math.round(principal + totalInterest)), color: SLATE_900  },
                    { label: 'Tenure',         value: `${months} months`,                         color: SLATE_500  },
                  ].map(({ label, value, color }) => (
                    <Box key={label} sx={{ flex: '1 1 140px', minWidth: 120 }}>
                      <Typography variant="caption" color={SLATE_500}>{label}</Typography>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ color }}>{value}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Amortization Table */}
                {showSchedule && (
                  <TableContainer sx={{ maxHeight: 420, borderRadius: 1, border: `1px solid ${SLATE_200}` }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {['#', 'Opening Balance', 'EMI', 'Principal', 'Interest', 'Closing Balance'].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 700, bgcolor: SLATE_50, fontSize: '0.72rem', whiteSpace: 'nowrap', py: 1 }}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map(row => (
                          <TableRow key={row.month} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                            <TableCell sx={{ fontSize: '0.78rem', color: SLATE_500 }}>{row.month}</TableCell>
                            <TableCell sx={{ fontSize: '0.78rem' }}>{INR(Math.round(row.opening))}</TableCell>
                            <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600, color: BLUE_600 }}>{INR(Math.round(row.emi))}</TableCell>
                            <TableCell sx={{ fontSize: '0.78rem', color: '#10B981' }}>{INR(Math.round(row.principal))}</TableCell>
                            <TableCell sx={{ fontSize: '0.78rem', color: '#F59E0B' }}>{INR(Math.round(row.interest))}</TableCell>
                            <TableCell sx={{ fontSize: '0.78rem' }}>{INR(Math.round(row.closing))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Box>
        );
      })()}

      {/* Action Dialog */}
      <ActionDialog
        open={!!actionDef}
        def={actionDef}
        onClose={() => setActionDef(null)}
        onConfirm={handleAction}
        loading={actionLoading}
      />

      {/* GL Journal Detail Dialog */}
      {f('disbursalJournalNumber') && (
        <JournalDetailDialog
          journalNumber={f('disbursalJournalNumber') as string}
          open={journalDialogOpen}
          onClose={() => setJournalDialogOpen(false)}
        />
      )}
    </Box>
  );
};

export default LoanDetail;

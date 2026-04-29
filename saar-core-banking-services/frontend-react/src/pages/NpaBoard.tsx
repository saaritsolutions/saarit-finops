import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, Dialog,
  DialogActions, DialogContent, DialogTitle, IconButton, Paper,
  Skeleton, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import RefreshIcon         from '@mui/icons-material/Refresh';
import WarningIcon         from '@mui/icons-material/Warning';
import CheckCircleIcon     from '@mui/icons-material/CheckCircle';
import DeleteForeverIcon   from '@mui/icons-material/DeleteForever';
import ExpandMoreIcon      from '@mui/icons-material/ExpandMore';
import ExpandLessIcon      from '@mui/icons-material/ExpandLess';
import PageHeader from '../components/common/PageHeader';
import {
  getNpaBoard, writeOffLoan,
  NpaBoardResult, NpaLoanItem,
} from '../services/npaBoardService';

// ── colour palette ────────────────────────────────────────────────────────────
const SLATE_50  = '#f8fafc';
const SLATE_100 = '#f1f5f9';
const SLATE_200 = '#e2e8f0';
const SLATE_500 = '#64748b';
const SLATE_700 = '#334155';
const SLATE_900 = '#0f172a';
const RED_600   = '#dc2626';
const RED_700   = '#b91c1c';
const RED_800   = '#991b1b';
const AMBER_600 = '#d97706';
const AMBER_700 = '#b45309';
const GREEN_600 = '#16a34a';

const INR = (n?: number | null) =>
  n == null
    ? '—'
    : '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PCT = (n: number) => (n * 100).toFixed(2) + '%';

const FMT_DATE = (s?: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── NPA sub-class chip ────────────────────────────────────────────────────────
const NPA_CHIP_COLORS: Record<string, { bg: string; color: string }> = {
  SUB_STANDARD: { bg: '#fff7ed', color: AMBER_700 },
  DOUBTFUL_1:   { bg: '#fef2f2', color: RED_600 },
  DOUBTFUL_2:   { bg: '#fde8e8', color: RED_700 },
  DOUBTFUL_3:   { bg: '#1f2937', color: '#ffffff' },
};
const NPA_CHIP_LABEL: Record<string, string> = {
  SUB_STANDARD: 'Sub-Standard',
  DOUBTFUL_1:   'Doubtful-1',
  DOUBTFUL_2:   'Doubtful-2',
  DOUBTFUL_3:   'Doubtful-3',
};

const NpaSubChip: React.FC<{ code?: string | null }> = ({ code }) => {
  if (!code) return null;
  const c = NPA_CHIP_COLORS[code] ?? { bg: SLATE_100, color: SLATE_700 };
  return (
    <Chip
      label={NPA_CHIP_LABEL[code] ?? code}
      size="small"
      sx={{ backgroundColor: c.bg, color: c.color, fontWeight: 600, fontSize: '0.7rem' }}
    />
  );
};

// ── SMA watch chip ────────────────────────────────────────────────────────────
const SMA_CHIP: Record<string, { bg: string; color: string }> = {
  'SMA-0': { bg: '#fefce8', color: AMBER_600 },
  'SMA-1': { bg: '#fff7ed', color: AMBER_700 },
  'SMA-2': { bg: '#fef2f2', color: RED_600 },
};
const SmaChip: React.FC<{ status: string }> = ({ status }) => {
  const c = SMA_CHIP[status] ?? { bg: SLATE_100, color: SLATE_700 };
  return (
    <Chip
      label={status}
      size="small"
      sx={{ backgroundColor: c.bg, color: c.color, fontWeight: 600, fontSize: '0.7rem' }}
    />
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}
const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, alert }) => (
  <Paper
    elevation={0}
    sx={{
      border: `1px solid ${alert ? '#fca5a5' : SLATE_200}`,
      borderRadius: 2,
      p: 2.5,
      flex: 1,
      minWidth: 160,
      backgroundColor: alert ? '#fff5f5' : '#ffffff',
    }}
  >
    <Typography variant="caption" color={SLATE_500} sx={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </Typography>
    <Typography variant="h5" sx={{ fontWeight: 700, color: alert ? RED_700 : SLATE_900, mt: 0.5 }}>
      {value}
    </Typography>
    {sub && (
      <Typography variant="caption" color={SLATE_500}>{sub}</Typography>
    )}
  </Paper>
);

// ── Write-Off Confirmation Dialog ─────────────────────────────────────────────
interface WriteOffDialogProps {
  open:        boolean;
  loan:        NpaLoanItem | null;
  onClose:     () => void;
  onConfirmed: () => void;
}
const WriteOffDialog: React.FC<WriteOffDialogProps> = ({ open, loan, onClose, onConfirmed }) => {
  const [reason,       setReason]       = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [err,          setErr]          = useState<string | null>(null);

  useEffect(() => {
    if (open) { setReason(''); setAuthorizedBy(''); setErr(null); }
  }, [open]);

  const handleSubmit = async () => {
    if (!loan) return;
    if (!reason.trim())       { setErr('Reason is required'); return; }
    if (!authorizedBy.trim()) { setErr('Authorized by is required'); return; }
    setSubmitting(true);
    setErr(null);
    try {
      await writeOffLoan(String(loan.id), { reason: reason.trim(), authorizedBy: authorizedBy.trim() });
      onConfirmed();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? 'Write-off failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: RED_800, fontWeight: 700 }}>
        Confirm NPA Write-Off
      </DialogTitle>
      <DialogContent>
        {loan && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You are about to write off <strong>{loan.applicationNumber}</strong> ({loan.applicantName}) —
            outstanding <strong>{INR(loan.outstandingPrincipal)}</strong>.
            This action is <strong>irreversible</strong>.
          </Alert>
        )}
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <TextField
          label="Reason for Write-Off"
          fullWidth
          multiline
          minRows={2}
          value={reason}
          onChange={e => setReason(e.target.value)}
          sx={{ mb: 2 }}
          aria-label="write-off reason"
        />
        <TextField
          label="Authorized By (user/designation)"
          fullWidth
          value={authorizedBy}
          onChange={e => setAuthorizedBy(e.target.value)}
          aria-label="write-off authorized by"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleSubmit}
          disabled={submitting}
          aria-label="confirm write off"
        >
          {submitting ? <CircularProgress size={18} color="inherit" /> : 'Write Off Loan'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const NpaBoard: React.FC = () => {
  const [data, setData]                     = useState<NpaBoardResult | null>(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [writeOffTarget, setWriteOffTarget] = useState<NpaLoanItem | null>(null);
  const [writtenOffOpen, setWrittenOffOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getNpaBoard();
      setData(result);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load NPA board data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const npaRatioPct = data ? data.npaRatio * 100 : 0;
  const highNpa     = npaRatioPct > 5;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="NPA Board"
        subtitle="RBI IRAC Classification — Non-Performing Assets & SMA Watch List"
        actions={
          <Tooltip title="Refresh">
            <IconButton onClick={load} disabled={loading} size="small" sx={{ border: `1px solid ${SLATE_200}` }}>
              {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── KPI Cards ── */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        {loading ? (
          [1,2,3,4,5].map(i => (
            <Skeleton key={i} variant="rectangular" height={88} sx={{ flex: 1, minWidth: 160, borderRadius: 2 }} />
          ))
        ) : (
          <>
            <KpiCard
              label="NPA Ratio"
              value={data ? PCT(data.npaRatio) : '0.00%'}
              sub={highNpa ? 'Above 5% threshold' : 'Within acceptable range'}
              alert={highNpa}
            />
            <KpiCard
              label="Total NPA Outstanding"
              value={INR(data?.totalNpaOutstanding)}
              sub={`${data?.npaLoans.length ?? 0} NPA account${data?.npaLoans.length !== 1 ? 's' : ''}`}
            />
            <KpiCard
              label="Required Provisioning"
              value={INR(data?.totalRequiredProvisioning)}
              sub="Per RBI IRAC norms (secured)"
            />
            <KpiCard
              label="SMA Watch Count"
              value={String(data?.smaWatchCount ?? 0)}
              sub={`${INR(data?.smaWatchOutstanding)} outstanding`}
            />
            <KpiCard
              label="Written Off (YTD)"
              value={String(data?.writtenOffCount ?? 0)}
              sub={`${INR(data?.writtenOffOutstanding)} written off`}
            />
          </>
        )}
      </Box>

      {/* ── NPA Loans Table ── */}
      <Paper elevation={0} sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2, mb: 3 }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${SLATE_200}`, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon sx={{ color: RED_600, fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700} color={SLATE_900}>
            NPA Accounts
          </Typography>
          {data && (
            <Chip label={data.npaLoans.length} size="small" sx={{ ml: 'auto', backgroundColor: '#fef2f2', color: RED_600 }} />
          )}
        </Box>

        {loading ? (
          <Box sx={{ p: 2 }}>
            {[1,2,3].map(i => <Skeleton key={i} height={40} sx={{ mb: 0.5 }} />)}
          </Box>
        ) : !data || data.npaLoans.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 40, color: GREEN_600, mb: 1 }} />
            <Typography variant="body1" color={GREEN_600} fontWeight={600}>
              No NPA Accounts
            </Typography>
            <Typography variant="body2" color={SLATE_500}>
              All disbursed loans are current.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ backgroundColor: SLATE_50 }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Application #</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Applicant</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }} align="right">Outstanding</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }} align="right">DPD</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Sub-Class</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }} align="right">Provisioning</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }} align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.npaLoans.map(row => (
                  <TableRow key={String(row.id)} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.applicationNumber}</TableCell>
                    <TableCell>{row.applicantName}</TableCell>
                    <TableCell>{row.productType}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>{INR(row.outstandingPrincipal)}</TableCell>
                    <TableCell align="right">
                      <Chip label={`${row.overdueDays}d`} size="small" sx={{ backgroundColor: '#fef2f2', color: RED_600, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell><NpaSubChip code={row.npaSubClassification} /></TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: RED_700 }}>{INR(row.requiredProvisioning)}</TableCell>
                    <TableCell align="center">
                      {row.npaSubClassification === 'DOUBTFUL_3' && (
                        <Tooltip title={`Write off ${row.applicationNumber}`}>
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Write off ${row.applicationNumber}`}
                            onClick={() => setWriteOffTarget(row)}
                          >
                            <DeleteForeverIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── SMA Watch List ── */}
      <Paper elevation={0} sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2, mb: 3 }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${SLATE_200}`, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon sx={{ color: AMBER_600, fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700} color={SLATE_900}>
            SMA Watch List
          </Typography>
          <Typography variant="caption" color={SLATE_500} sx={{ ml: 1 }}>
            Early-warning accounts at risk of NPA classification
          </Typography>
          {data && (
            <Chip label={data.smaWatchList.length} size="small" sx={{ ml: 'auto', backgroundColor: '#fff7ed', color: AMBER_700 }} />
          )}
        </Box>

        {loading ? (
          <Box sx={{ p: 2 }}>
            {[1,2].map(i => <Skeleton key={i} height={40} sx={{ mb: 0.5 }} />)}
          </Box>
        ) : !data || data.smaWatchList.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 40, color: GREEN_600, mb: 1 }} />
            <Typography variant="body1" color={GREEN_600} fontWeight={600}>
              No SMA Watch Accounts
            </Typography>
            <Typography variant="body2" color={SLATE_500}>
              No loans in SMA-0, SMA-1, or SMA-2 status.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ backgroundColor: SLATE_50 }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Application #</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Applicant</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }} align="right">Outstanding</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }} align="right">DPD</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>SMA Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.smaWatchList.map(row => (
                  <TableRow key={String(row.id)} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.applicationNumber}</TableCell>
                    <TableCell>{row.applicantName}</TableCell>
                    <TableCell>{row.productType}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>{INR(row.outstandingPrincipal)}</TableCell>
                    <TableCell align="right">
                      <Chip label={`${row.overdueDays}d`} size="small" sx={{ backgroundColor: '#fff7ed', color: AMBER_700, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell><SmaChip status={row.smaStatus} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Written-Off Loans (collapsible) ── */}
      {data && data.writtenOffLoans.length > 0 && (
        <Paper elevation={0} sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2, opacity: 0.85 }}>
          <Box
            sx={{ px: 2.5, py: 2,
                  borderBottom: writtenOffOpen ? `1px solid ${SLATE_200}` : 'none',
                  display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
            onClick={() => setWrittenOffOpen(o => !o)}
          >
            <DeleteForeverIcon sx={{ color: SLATE_500, fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700} color={SLATE_700}>
              Written-Off Loans
            </Typography>
            <Typography variant="caption" color={SLATE_500} sx={{ ml: 1 }}>
              Removed from active loan book
            </Typography>
            <Chip
              label={data.writtenOffLoans.length}
              size="small"
              sx={{ ml: 'auto', backgroundColor: SLATE_100, color: SLATE_700 }}
            />
            <IconButton size="small" sx={{ ml: 0.5 }}>
              {writtenOffOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={writtenOffOpen}>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ backgroundColor: SLATE_50 }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Application #</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Applicant</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: SLATE_700 }} align="right">Outstanding (at write-off)</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Write-Off Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Reason</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: SLATE_700 }}>Journal #</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.writtenOffLoans.map(row => (
                    <TableRow key={String(row.id)} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.applicationNumber}</TableCell>
                      <TableCell>{row.applicantName}</TableCell>
                      <TableCell>{row.productType}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500 }}>{INR(row.outstandingPrincipal)}</TableCell>
                      <TableCell>{FMT_DATE(row.writeOffDate)}</TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.writeOffReason ?? '—'}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: SLATE_500 }}>
                        {row.writeOffJournalNumber ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Collapse>
        </Paper>
      )}

      {/* ── Write-Off Confirmation Dialog ── */}
      <WriteOffDialog
        open={writeOffTarget !== null}
        loan={writeOffTarget}
        onClose={() => setWriteOffTarget(null)}
        onConfirmed={load}
      />
    </Box>
  );
};

export default NpaBoard;

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Timeline, TimelineConnector, TimelineContent, TimelineDot,
  TimelineItem, TimelineSeparator,
} from '@mui/lab';
import DiamondIcon        from '@mui/icons-material/Diamond';
import ArrowBackIcon      from '@mui/icons-material/ArrowBack';
import RefreshIcon        from '@mui/icons-material/Refresh';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import HourglassIcon      from '@mui/icons-material/HourglassBottom';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import LockIcon           from '@mui/icons-material/Lock';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getGoldLoanDetail, takeGoldLoanAction,
  type GoldLoanDetail as GoldLoanDetailType,
} from '../services/goldLoanService';
import JournalDetailDialog from '../components/dialogs/JournalDetailDialog';

// ── Design tokens ──────────────────────────────────────────────────────────────
const BLUE_600  = '#2563EB';
const BLUE_50   = '#EFF6FF';
const SLATE_50  = '#F8FAFC';
const SLATE_200 = '#E2E8F0';
const SLATE_500 = '#64748B';
const GOLD_500  = '#EAB308';
const GOLD_BG   = '#FEF9C3';

const INR = (n?: number | null) =>
  n != null ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}` : '—';

const WGT = (n?: number | null) => n != null ? `${n.toFixed(3)} g` : '—';

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const fmtDateOnly = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—';

const n2s = (v: any) => (v !== null && v !== undefined && v !== '') ? String(v) : '—';

// ── Gold loan status config ────────────────────────────────────────────────────
type StatusColor = 'default' | 'warning' | 'info' | 'success' | 'error' | 'primary' | 'secondary';
const STATUS_CFG: Record<string, { label: string; color: StatusColor }> = {
  DRAFT:      { label: 'Draft',      color: 'default'   },
  SUBMITTED:  { label: 'Submitted',  color: 'info'      },
  APPRAISED:  { label: 'Appraised',  color: 'secondary' },
  SANCTIONED: { label: 'Sanctioned', color: 'warning'   },
  DISBURSED:  { label: 'Disbursed',  color: 'success'   },
  CLOSED:     { label: 'Closed',     color: 'default'   },
};

// ── Action dialog definitions ─────────────────────────────────────────────────
interface ActionDef {
  action:     string;
  label:      string;
  color:      'primary' | 'success' | 'warning' | 'error';
  title:      string;
  fields?:    React.ReactNode;
}

// ── DL Row helper ─────────────────────────────────────────────────────────────
const DLRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Stack direction="row" spacing={2} sx={{ py: 0.75, borderBottom: `1px solid ${SLATE_200}` }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>{label}</Typography>
    <Typography variant="body2" fontWeight={500}>{value ?? '—'}</Typography>
  </Stack>
);

export default function GoldLoanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail,   setDetail]   = useState<GoldLoanDetailType | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [tabIdx,   setTabIdx]   = useState(0);
  const [error,    setError]    = useState<string | null>(null);

  // Action dialog state
  const [actionOpen, setActionOpen]         = useState(false);
  const [currentAction, setCurrentAction]   = useState<ActionDef | null>(null);
  const [actionLoading, setActionLoading]   = useState(false);
  const [actionError,   setActionError]     = useState<string | null>(null);

  // Action dialog field state
  const [appraiserName,    setAppraiserName]    = useState('');
  const [appraiserEmpId,   setAppraiserEmpId]   = useState('');
  const [vaultLocation,    setVaultLocation]    = useState('');
  const [sanctionedAmt,    setSanctionedAmt]    = useState('');
  const [comments,         setComments]         = useState('');
  const [disbAcct,         setDisbAcct]         = useState('');
  const [principalRepaid,  setPrincipalRepaid]  = useState('');
  const [interestPaid,     setInterestPaid]     = useState('');

  // Journal dialog
  const [journalNum, setJournalNum] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await getGoldLoanDetail(id);
      setDetail(d);
      // Pre-fill close form with expected amounts
      setSanctionedAmt(String(d.sanctionedAmount || ''));
      setPrincipalRepaid(String(d.sanctionedAmount || ''));
      setInterestPaid(String(d.totalInterestAmount || ''));
    } catch {
      setError('Failed to load application.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Action definitions (computed from detail) ──────────────────────────────
  const getActions = (d: GoldLoanDetailType): ActionDef[] => {
    switch (d.goldLoanStatus) {
      case 'DRAFT': return [{
        action: 'SUBMIT', label: 'Submit Application', color: 'primary',
        title: 'Submit for Appraisal?',
      }];
      case 'SUBMITTED': return [{
        action: 'APPRAISE', label: 'Appraise', color: 'primary',
        title: 'Record Appraisal',
        fields: (
          <Stack spacing={2}>
            <TextField label="Appraiser Name *" value={appraiserName}
              onChange={e => setAppraiserName(e.target.value)} fullWidth />
            <TextField label="Employee ID" value={appraiserEmpId}
              onChange={e => setAppraiserEmpId(e.target.value)} fullWidth />
            <TextField label="Vault / Branch Location" value={vaultLocation}
              onChange={e => setVaultLocation(e.target.value)} fullWidth />
          </Stack>
        ),
      }];
      case 'APPRAISED': return [{
        action: 'SANCTION', label: 'Sanction Loan', color: 'success',
        title: 'Sanction Gold Loan',
        fields: (
          <Stack spacing={2}>
            <TextField label="Sanctioned Amount (₹) *" type="number"
              value={sanctionedAmt} onChange={e => setSanctionedAmt(e.target.value)} fullWidth
              helperText={`Max @ 75% LTV: ${INR(Math.floor(d.totalValuedAmount * 0.75))}`} />
            <TextField label="Comments" value={comments}
              onChange={e => setComments(e.target.value)} multiline rows={2} fullWidth />
          </Stack>
        ),
      }];
      case 'SANCTIONED': return [{
        action: 'DISBURSE', label: 'Disburse', color: 'success',
        title: 'Confirm Disbursal',
        fields: (
          <Stack spacing={2}>
            <Alert severity="info">
              ₹{INR(d.sanctionedAmount)} will be disbursed.<br />
              GL journal: DR 1025 Gold Loans Outstanding / CR 1010 Cash and Bank
            </Alert>
            <TextField label="Disbursement Account Number" value={disbAcct}
              onChange={e => setDisbAcct(e.target.value)} fullWidth />
          </Stack>
        ),
      }];
      case 'DISBURSED': return [{
        action: 'CLOSE', label: 'Repay & Close', color: 'warning',
        title: 'Record Repayment & Close',
        fields: (
          <Stack spacing={2}>
            <TextField label="Principal Repaid (₹)" type="number"
              value={principalRepaid} onChange={e => setPrincipalRepaid(e.target.value)} fullWidth />
            <TextField label="Interest Paid (₹)" type="number"
              value={interestPaid} onChange={e => setInterestPaid(e.target.value)} fullWidth
              helperText={`Expected: ${INR(d.totalInterestAmount)}`} />
            <Alert severity="info">
              GL journal: DR 1010 Cash / CR 1025 Gold Loans Outstanding + CR 4015 Interest Income
            </Alert>
          </Stack>
        ),
      }];
      default: return [];
    }
  };

  const handleActionClick = (def: ActionDef) => {
    setCurrentAction(def);
    setActionError(null);
    setActionOpen(true);
  };

  const handleActionSubmit = async () => {
    if (!currentAction || !id || !detail) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await takeGoldLoanAction(id, {
        action:                    currentAction.action,
        appraiserName:             appraiserName || undefined,
        appraiserEmployeeId:       appraiserEmpId || undefined,
        vaultLocation:             vaultLocation || undefined,
        sanctionedAmount:          sanctionedAmt ? parseFloat(sanctionedAmt) : undefined,
        comments:                  comments || undefined,
        disbursementAccountNumber: disbAcct || undefined,
        principalRepaid:           principalRepaid ? parseFloat(principalRepaid) : undefined,
        interestPaid:              interestPaid ? parseFloat(interestPaid) : undefined,
      });
      setActionOpen(false);
      await load();
    } catch (err: any) {
      setActionError(err?.response?.data?.error ?? err?.message ?? 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress />
    </Box>
  );

  if (error || !detail) return (
    <Box sx={{ p: 3 }}><Alert severity="error">{error ?? 'Application not found.'}</Alert></Box>
  );

  const statusCfg = STATUS_CFG[detail.goldLoanStatus] ?? { label: detail.goldLoanStatus, color: 'default' as StatusColor };
  const actionDefs = getActions(detail);

  // Pledge totals
  const totalNet   = detail.pledgeItems.reduce((s, p) => s + p.netWeightGrams, 0);
  const totalValue = detail.pledgeItems.reduce((s, p) => s + p.valuedAmount, 0);
  const maxEligible = Math.floor(totalValue * 0.75);

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      {/* ── Header ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gold-loans')} variant="text" size="small">
            Gold Loans
          </Button>
          <Typography color="text.secondary">/</Typography>
          <Typography fontWeight={600}>{detail.applicationNumber}</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <Button size="small" variant="outlined" onClick={load} startIcon={<RefreshIcon />}>
              Refresh
            </Button>
          </Tooltip>
          {actionDefs.map(def => (
            <Button key={def.action} variant="contained" color={def.color}
              onClick={() => handleActionClick(def)}>
              {def.label}
            </Button>
          ))}
        </Stack>
      </Stack>

      {/* ── Summary card ── */}
      <Card sx={{ mb: 3, background: GOLD_BG, border: `1px solid ${GOLD_500}33` }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="flex-start">
            <DiamondIcon sx={{ fontSize: 48, color: GOLD_500, mt: 0.5 }} />
            <Box flex={1}>
              <Stack direction="row" spacing={2} alignItems="center" mb={0.5}>
                <Typography variant="h5" fontWeight={700}>{detail.applicationNumber}</Typography>
                <Chip label={statusCfg.label} color={statusCfg.color} />
              </Stack>
              <Typography variant="h6">{detail.applicantName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {detail.panNumber}{detail.mobileNumber && ` · ${detail.mobileNumber}`}
              </Typography>
            </Box>
            <Stack spacing={1} alignItems="flex-end">
              {detail.sanctionedAmount > 0 && (
                <Box textAlign="right">
                  <Typography variant="caption" color="text.secondary">Sanctioned</Typography>
                  <Typography variant="h5" fontWeight={700} color={BLUE_600}>
                    {INR(detail.sanctionedAmount)}
                  </Typography>
                </Box>
              )}
              {detail.pledgeReceiptNumber && (
                <Chip label={`Receipt: ${detail.pledgeReceiptNumber}`} variant="outlined" size="small" />
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <Tabs value={tabIdx} onChange={(_, v) => setTabIdx(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Pledge Items" />
        <Tab label="Loan Terms" />
        <Tab label="Timeline" />
      </Tabs>

      {/* TAB 0 — Pledge Items */}
      {tabIdx === 0 && (
        <Card>
          <CardContent>
            {detail.pledgeItems.length === 0 ? (
              <Typography color="text.secondary">No pledge items yet.</Typography>
            ) : (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: SLATE_50 }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Gross Wt</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Stone Ded</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Net Wt</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Purity</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Rate/g</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Valued Amt</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Packet #</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Released</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detail.pledgeItems.map(p => (
                        <TableRow key={p.id} hover>
                          <TableCell><Chip label={p.itemType} size="small" variant="outlined" /></TableCell>
                          <TableCell sx={{ color: SLATE_500 }}>{p.description || '—'}</TableCell>
                          <TableCell align="right">{WGT(p.grossWeightGrams)}</TableCell>
                          <TableCell align="right">{WGT(p.stoneDeductionGrams)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{WGT(p.netWeightGrams)}</TableCell>
                          <TableCell align="right">{p.purityCarats}K</TableCell>
                          <TableCell align="right">
                            {p.goldRatePerGram > 0 ? INR(p.goldRatePerGram) : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: GOLD_500, fontWeight: 600 }}>
                            {p.valuedAmount > 0 ? INR(p.valuedAmount) : '—'}
                          </TableCell>
                          <TableCell sx={{ color: SLATE_500 }}>{p.packetNumber || '—'}</TableCell>
                          <TableCell>
                            {p.isReleased
                              ? <Chip label="Released" color="success" size="small" />
                              : <Chip label="In Custody" color="warning" size="small" />
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals row */}
                      <TableRow sx={{ bgcolor: GOLD_BG }}>
                        <TableCell colSpan={4} sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{WGT(totalNet)}</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell align="right" sx={{ fontWeight: 700, color: GOLD_500 }}>
                          {INR(totalValue)}
                        </TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* LTV summary */}
                <Box sx={{ mt: 2, p: 1.5, bgcolor: BLUE_50, borderRadius: 1 }}>
                  <Stack direction="row" spacing={4} flexWrap="wrap">
                    <Box>
                      <Typography variant="caption" color="text.secondary">Max Eligible @ 75% LTV</Typography>
                      <Typography fontWeight={700} color={BLUE_600}>{INR(maxEligible)}</Typography>
                    </Box>
                    {detail.ltvPercent > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Actual LTV</Typography>
                        <Typography fontWeight={700}
                          color={detail.ltvPercent > 75 ? 'error.main' : detail.ltvPercent > 70 ? 'warning.main' : 'success.main'}>
                          {detail.ltvPercent.toFixed(2)}%
                        </Typography>
                      </Box>
                    )}
                    {detail.goldRateAtAppraisal > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Rate at Appraisal</Typography>
                        <Typography fontWeight={600}>{INR(detail.goldRateAtAppraisal)}/g</Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 1 — Loan Terms */}
      {tabIdx === 1 && (
        <Card>
          <CardContent>
            <Stack spacing={0}>
              <DLRow label="Repayment Scheme"   value={detail.repaymentScheme} />
              <DLRow label="Tenure"              value={`${detail.tenureMonths} months`} />
              <DLRow label="Maturity Date"       value={fmtDateOnly(detail.maturityDate)} />
              <DLRow label="Sanctioned Amount"   value={INR(detail.sanctionedAmount)} />
              <DLRow label="Interest Rate"       value={`${detail.interestRatePercent}% p.a.`} />
              <DLRow label="Total Interest"      value={INR(detail.totalInterestAmount)} />
              <DLRow label="Total Amount Due"    value={INR(detail.totalAmountDue)} />
              <DLRow label="Appraiser"           value={detail.appraiserName} />
              <DLRow label="Appraiser Emp ID"    value={detail.appraiserEmployeeId} />
              <DLRow label="Vault / Branch"      value={detail.vaultLocation} />
              <DLRow label="Pledge Receipt #"    value={detail.pledgeReceiptNumber} />
              <DLRow label="Appraised At"        value={fmtDate(detail.appraisedAt)} />
              <DLRow label="Sanctioned At"       value={fmtDate(detail.sanctionedAt)} />
              <DLRow label="Disbursed At"        value={fmtDate(detail.disbursedAt)} />
              <DLRow label="Closed At"           value={fmtDate(detail.closedAt)} />
              <DLRow label="Gold Released At"    value={fmtDate(detail.goldReleasedAt)} />
              {detail.disbursalJournalNumber && (
                <Stack direction="row" spacing={2} sx={{ py: 0.75, borderBottom: `1px solid ${SLATE_200}` }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>
                    Disbursal Journal
                  </Typography>
                  <Chip
                    label={detail.disbursalJournalNumber}
                    size="small"
                    color="primary"
                    variant="outlined"
                    onClick={() => setJournalNum(detail.disbursalJournalNumber!)}
                    sx={{ cursor: 'pointer' }}
                  />
                </Stack>
              )}
              {detail.closureJournalNumber && (
                <Stack direction="row" spacing={2} sx={{ py: 0.75, borderBottom: `1px solid ${SLATE_200}` }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>
                    Closure Journal
                  </Typography>
                  <Chip
                    label={detail.closureJournalNumber}
                    size="small"
                    color="success"
                    variant="outlined"
                    onClick={() => setJournalNum(detail.closureJournalNumber!)}
                    sx={{ cursor: 'pointer' }}
                  />
                </Stack>
              )}
            </Stack>
            {/* Bank-Configured Fields from DFS */}
            {detail.formDataJson && (() => {
              try {
                const cf = JSON.parse(detail.formDataJson) as Record<string, any>;
                const entries = Object.entries(cf).filter(([, v]) => v !== '' && v !== null && v !== undefined);
                if (entries.length === 0) return null;
                return (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Bank-Configured Fields
                    </Typography>
                    {entries.map(([key, val]) => (
                      <Stack key={key} direction="row" spacing={2} sx={{ py: 0.75, borderBottom: `1px solid ${SLATE_200}` }}>
                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>{key}</Typography>
                        <Typography variant="body2" fontWeight={500}>{String(val)}</Typography>
                      </Stack>
                    ))}
                  </Box>
                );
              } catch { return null; }
            })()}
          </CardContent>
        </Card>
      )}

      {/* TAB 2 — Timeline */}
      {tabIdx === 2 && (
        <Card>
          <CardContent>
            {detail.actions.length === 0 ? (
              <Typography color="text.secondary">No actions recorded yet.</Typography>
            ) : (
              <Timeline>
                {detail.actions.map((a, i) => (
                  <TimelineItem key={a.id}>
                    <TimelineSeparator>
                      <TimelineDot color={
                        a.action === 'CLOSE'    ? 'success' :
                        a.action === 'DISBURSE' ? 'success' :
                        a.action === 'SANCTION' ? 'warning' :
                        a.action === 'APPRAISE' ? 'secondary' : 'primary'
                      }>
                        {a.action === 'CLOSE' || a.action === 'DISBURSE'
                          ? <CheckCircleIcon sx={{ fontSize: 14 }} />
                          : a.action === 'CREATED'
                          ? <DiamondIcon sx={{ fontSize: 14 }} />
                          : <HourglassIcon sx={{ fontSize: 14 }} />
                        }
                      </TimelineDot>
                      {i < detail.actions.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent sx={{ py: '8px', px: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" fontWeight={600}>{a.action}</Typography>
                        {a.toStatus && (
                          <Chip label={STATUS_CFG[a.toStatus]?.label ?? a.toStatus}
                            color={STATUS_CFG[a.toStatus]?.color ?? 'default'} size="small" />
                        )}
                      </Stack>
                      {a.actionDescription && (
                        <Typography variant="body2" color="text.secondary">{a.actionDescription}</Typography>
                      )}
                      {a.comments && (
                        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>"{a.comments}"</Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {a.actionBy ?? 'system'} · {fmtDate(a.actionAt)}
                      </Typography>
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Action Dialog ── */}
      <Dialog open={actionOpen} onClose={() => setActionOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{currentAction?.title}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
          {currentAction?.fields}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionOpen(false)} disabled={actionLoading}>Cancel</Button>
          <Button
            variant="contained"
            color={currentAction?.color ?? 'primary'}
            disabled={actionLoading}
            onClick={handleActionSubmit}
            startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {actionLoading ? 'Processing…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Journal Detail Dialog ── */}
      {journalNum && (
        <JournalDetailDialog
          journalNumber={journalNum}
          open={!!journalNum}
          onClose={() => setJournalNum(null)}
        />
      )}
    </Box>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
  Stack,
} from '@mui/material';
import {
  GetApp as DownloadIcon,
  BarChart as BarChartIcon,
  AccountBalance as AccountBalanceIcon,
  NotificationsActive as AlertIcon,
  Savings as SavingsIcon,
  TrendingUp as TrendingUpIcon,
  PlayArrow as RunIcon,
  AccountBalanceWallet as PostIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import PageHeader from '../../components/common/PageHeader';
import {
  getDailySummary,
  getLedgerBalances,
  getComplianceAlerts,
  reviewComplianceAlert,
  getUpcomingMaturities,
  type DailySummaryReport,
  type LedgerBalanceRecord,
  type ComplianceAlert,
  type UpcomingMaturity,
} from '../../services/reportService';
import {
  getAccrualSummary,
  runDailyAccrual,
  runMonthlyPosting,
  type AccrualSummaryDay,
  type MonthlyPostingResult,
} from '../../services/interestFeeService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function subDays(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function INR(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function daysLeftChip(days: number) {
  if (days <= 7)  return <Chip label={`${days}d`} size="small" color="error"   sx={{ fontWeight: 600 }} />;
  if (days <= 14) return <Chip label={`${days}d`} size="small" color="warning" sx={{ fontWeight: 600 }} />;
  return               <Chip label={`${days}d`} size="small" color="success" sx={{ fontWeight: 600 }} />;
}

function alertStatusChip(status: string) {
  const color =
    status === 'PENDING'   ? 'warning' :
    status === 'FILED'     ? 'success' :
    status === 'DISMISSED' ? 'default' : 'default';
  return <Chip label={status} size="small" color={color as any} />;
}

// ── TabPanel ──────────────────────────────────────────────────────────────────

interface TabPanelProps { children?: React.ReactNode; index: number; value: number; }

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`rpt-tabpanel-${index}`}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const Reports: React.FC = () => {
  const location = useLocation();
  const initTab  = location.pathname.includes('regulatory') ? 1
                 : location.pathname.includes('maturity')   ? 2
                 : 0;

  const [tab, setTab] = useState(initTab);

  // ── Tab 0 — Financial Reports ─────────────────────────────────────────────
  const [balances, setBalances]               = useState<LedgerBalanceRecord[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [summary, setSummary]                 = useState<DailySummaryReport | null>(null);
  const [summaryLoading, setSummaryLoading]   = useState(false);
  const [fromDate, setFromDate]               = useState(formatDateInput(subDays(29)));
  const [toDate,   setToDate]                 = useState(formatDateInput(new Date()));

  // ── Tab 1 — Compliance Alerts ──────────────────────────────────────────────
  const [alerts, setAlerts]               = useState<ComplianceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [statusFilter, setStatusFilter]   = useState('');
  const [reviewAlert, setReviewAlert]     = useState<ComplianceAlert | null>(null);
  const [reviewAction, setReviewAction]   = useState<'FILED' | 'DISMISSED'>('FILED');
  const [reviewNotes, setReviewNotes]     = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [reviewError,   setReviewError]   = useState('');

  // ── Tab 2 — Deposit Maturity ──────────────────────────────────────────────
  const [maturities, setMaturities]               = useState<UpcomingMaturity[]>([]);
  const [maturitiesLoading, setMaturitiesLoading] = useState(false);

  // ── Tab 3 — Deposit Interest (SAAR-IFS-001) ───────────────────────────────
  const [accrualData, setAccrualData]             = useState<AccrualSummaryDay[]>([]);
  const [accrualLoading, setAccrualLoading]       = useState(false);
  const [accrualError, setAccrualError]           = useState('');
  const [ifsFromDate, setIfsFromDate]             = useState(formatDateInput(subDays(29)));
  const [ifsToDate,   setIfsToDate]               = useState(formatDateInput(new Date()));
  const [accrualRunning, setAccrualRunning]       = useState(false);
  const [accrualMsg, setAccrualMsg]               = useState('');
  const [postingRunning, setPostingRunning]       = useState(false);
  const [postingResult, setPostingResult]         = useState<MonthlyPostingResult | null>(null);

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadBalances = useCallback(() => {
    setBalancesLoading(true);
    getLedgerBalances()
      .then(setBalances)
      .catch(() => {})
      .finally(() => setBalancesLoading(false));
  }, []);

  const loadSummary = useCallback(() => {
    setSummaryLoading(true);
    getDailySummary(fromDate, toDate)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [fromDate, toDate]);

  const loadAlerts = useCallback(() => {
    setAlertsLoading(true);
    getComplianceAlerts(statusFilter || undefined)
      .then(res => setAlerts(res.items))
      .catch(() => setAlerts([]))
      .finally(() => setAlertsLoading(false));
  }, [statusFilter]);

  const loadMaturities = useCallback(() => {
    setMaturitiesLoading(true);
    getUpcomingMaturities(30)
      .then(setMaturities)
      .catch(() => setMaturities([]))
      .finally(() => setMaturitiesLoading(false));
  }, []);

  const loadAccrualSummary = useCallback(() => {
    setAccrualLoading(true);
    setAccrualError('');
    getAccrualSummary(undefined, ifsFromDate, ifsToDate)
      .then(setAccrualData)
      .catch(() => { setAccrualError('Unable to load accrual data.'); setAccrualData([]); })
      .finally(() => setAccrualLoading(false));
  }, [ifsFromDate, ifsToDate]);

  async function handleRunDailyAccrual() {
    setAccrualRunning(true);
    setAccrualMsg('');
    try {
      const res = await runDailyAccrual();
      setAccrualMsg(`Accrual completed for ${res.date}`);
      loadAccrualSummary();
    } catch {
      setAccrualMsg('Accrual failed — check service logs.');
    } finally {
      setAccrualRunning(false);
    }
  }

  async function handleRunMonthlyPosting() {
    const period = new Date().toISOString().slice(0, 7).replace('-', '');
    setPostingRunning(true);
    setPostingResult(null);
    try {
      const res = await runMonthlyPosting(period);
      setPostingResult(res);
      loadAccrualSummary();
    } catch {
      setAccrualMsg('Monthly posting failed — check service logs.');
    } finally {
      setPostingRunning(false);
    }
  }

  // ── Lazy load on tab activation ───────────────────────────────────────────

  useEffect(() => {
    if (tab === 0) { loadBalances(); loadSummary(); }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 1) loadAlerts();
  }, [tab, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 2) loadMaturities();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 3) loadAccrualSummary();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CSV export ────────────────────────────────────────────────────────────

  function exportCsv() {
    if (!summary) return;
    const header = 'Date,Journal Count,Total Debit,Total Credit\n';
    const rows   = summary.days
      .map(d => `${String(d.date).slice(0, 10)},${d.journalCount},${d.totalDebit},${d.totalCredit}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `journal-summary-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Review alert ──────────────────────────────────────────────────────────

  async function submitReview() {
    if (!reviewAlert) return;
    setReviewLoading(true);
    setReviewError('');
    try {
      await reviewComplianceAlert(reviewAlert.id, reviewAction, reviewNotes);
      setReviewSuccess(`Alert marked as ${reviewAction}.`);
      setReviewAlert(null);
      setReviewNotes('');
      loadAlerts();
    } catch {
      setReviewError('Failed to update alert. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  }

  // ── Chart data ────────────────────────────────────────────────────────────

  const chartData = (summary?.days ?? []).map(d => ({
    date:  String(d.date).slice(0, 10),
    debit:  d.totalDebit,
    credit: d.totalCredit,
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      <PageHeader
        title="Reports & MIS"
        subtitle="Financial reports, compliance alerts, and deposit maturity overview"
      />

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab icon={<BarChartIcon     fontSize="small" />} iconPosition="start" label="Financial Reports"  id="rpt-tab-0" />
          <Tab icon={<AlertIcon        fontSize="small" />} iconPosition="start" label="Compliance Alerts" id="rpt-tab-1" />
          <Tab icon={<SavingsIcon      fontSize="small" />} iconPosition="start" label="Deposit Maturity"  id="rpt-tab-2" />
          <Tab icon={<TrendingUpIcon   fontSize="small" />} iconPosition="start" label="Deposit Interest"  id="rpt-tab-3" />
        </Tabs>

        {/* ── Tab 0: Financial Reports ─────────────────────────────────────── */}
        <TabPanel value={tab} index={0}>

          {/* GL Balance Summary */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountBalanceIcon fontSize="small" color="primary" />
              GL Account Balances
            </Typography>

            {balancesLoading ? (
              <Stack spacing={1}>{[1,2,3].map(i => <Skeleton key={i} height={40} />)}</Stack>
            ) : balances.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>No GL accounts found.</Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                      <TableCell>Code</TableCell>
                      <TableCell>Account Name</TableCell>
                      <TableCell align="right">Total Debits</TableCell>
                      <TableCell align="right">Total Credits</TableCell>
                      <TableCell align="right">Net Balance</TableCell>
                      <TableCell>Type</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {balances.map(b => {
                      const net = b.normalBalance === 'Credit'
                        ? b.creditTotal - b.debitTotal
                        : b.debitTotal  - b.creditTotal;
                      return (
                        <TableRow key={b.accountCode} hover>
                          <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{b.accountCode}</TableCell>
                          <TableCell>{b.accountName ?? b.accountCode}</TableCell>
                          <TableCell align="right">{INR(b.debitTotal)}</TableCell>
                          <TableCell align="right">{INR(b.creditTotal)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{INR(Math.abs(net))}</TableCell>
                          <TableCell>
                            <Chip
                              label={b.normalBalance}
                              size="small"
                              color={b.normalBalance === 'Credit' ? 'primary' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {/* Daily Transaction Volume */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BarChartIcon fontSize="small" color="primary" />
              Daily Transaction Volume
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
              <TextField
                type="date"
                label="From"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
              <TextField
                type="date"
                label="To"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={loadSummary}
                disabled={summaryLoading}
              >
                {summaryLoading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Load
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={exportCsv}
                disabled={!summary || summary.days.length === 0}
                aria-label="Export CSV"
              >
                Export CSV
              </Button>
            </Box>

            {summaryLoading ? (
              <Skeleton variant="rectangular" height={260} />
            ) : !summary || summary.days.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  No journal activity in the selected date range.
                </Typography>
              </Box>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={v => `₹${((v as number) / 100000).toFixed(0)}L`}
                      tick={{ fontSize: 11 }}
                    />
                    <RechartsTooltip
                      formatter={(value: unknown) => INR(value as number)}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Legend />
                    <Bar dataKey="debit"  name="Debits"  fill="#2563EB" radius={[3,3,0,0]} />
                    <Bar dataKey="credit" name="Credits" fill="#16A34A" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>

                <Box sx={{ mt: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Journals: <strong>{summary.grandTotalCount}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Debits: <strong>{INR(summary.grandTotalDebit)}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Credits: <strong>{INR(summary.grandTotalCredit)}</strong>
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </TabPanel>

        {/* ── Tab 1: Compliance Alerts ─────────────────────────────────────── */}
        <TabPanel value={tab} index={1}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>Filter:</Typography>
            {['', 'PENDING', 'FILED', 'DISMISSED'].map(s => (
              <Chip
                key={s || 'ALL'}
                label={s || 'ALL'}
                onClick={() => setStatusFilter(s)}
                color={statusFilter === s ? 'primary' : 'default'}
                variant={statusFilter === s ? 'filled' : 'outlined'}
                size="small"
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>

          {reviewSuccess && (
            <Alert severity="success" onClose={() => setReviewSuccess('')} sx={{ mb: 2 }}>
              {reviewSuccess}
            </Alert>
          )}

          {alertsLoading ? (
            <Stack spacing={1}>{[1,2,3].map(i => <Skeleton key={i} height={40} />)}</Stack>
          ) : alerts.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <AlertIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography color="text.secondary">
                No compliance alerts{statusFilter ? ` with status ${statusFilter}` : ''}.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                    <TableCell>Type</TableCell>
                    <TableCell>Journal #</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alerts.map(a => (
                    <TableRow key={a.id} hover>
                      <TableCell>
                        <Chip
                          label={a.alertType}
                          size="small"
                          color={a.alertType === 'CTR' ? 'error' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{a.journalNumber}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{INR(a.triggerAmount)}</TableCell>
                      <TableCell>{alertStatusChip(a.status)}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        {new Date(a.createdAt).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell>
                        {a.status === 'PENDING' && (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              onClick={() => { setReviewAlert(a); setReviewAction('FILED'); }}
                              sx={{ fontSize: '0.7rem', py: 0.25, px: 1 }}
                            >
                              File
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="inherit"
                              onClick={() => { setReviewAlert(a); setReviewAction('DISMISSED'); }}
                              sx={{ fontSize: '0.7rem', py: 0.25, px: 1 }}
                            >
                              Dismiss
                            </Button>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* ── Tab 2: Deposit Maturity ──────────────────────────────────────── */}
        <TabPanel value={tab} index={2}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            FD/RD accounts maturing in the next 30 days
          </Typography>

          {maturitiesLoading ? (
            <Stack spacing={1}>{[1,2,3].map(i => <Skeleton key={i} height={40} />)}</Stack>
          ) : maturities.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <SavingsIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">
                No deposits maturing in the next 30 days.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                    <TableCell>Account #</TableCell>
                    <TableCell>Customer ID</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Principal</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell>Maturity Date</TableCell>
                    <TableCell align="right">Projected Payout</TableCell>
                    <TableCell>Days Left</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {maturities.map(m => (
                    <TableRow key={m.accountId} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{m.accountNumber}</TableCell>
                      <TableCell>{m.customerId}</TableCell>
                      <TableCell>
                        <Chip label={m.productType} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{INR(m.principal)}</TableCell>
                      <TableCell align="right">{m.annualRate.toFixed(2)}%</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {new Date(m.maturityDate).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{INR(m.projectedPayout)}</TableCell>
                      <TableCell>{daysLeftChip(m.daysToMaturity)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* ── Tab 3: Deposit Interest ──────────────────────────────────────── */}
        <TabPanel value={tab} index={3}>

          {/* Action row */}
          <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
            <TextField
              label="From" type="date" size="small"
              value={ifsFromDate}
              onChange={e => setIfsFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 170 }}
            />
            <TextField
              label="To" type="date" size="small"
              value={ifsToDate}
              onChange={e => setIfsToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 170 }}
            />
            <Button variant="outlined" onClick={loadAccrualSummary} disabled={accrualLoading}>
              Refresh
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<RunIcon />}
              onClick={handleRunDailyAccrual}
              disabled={accrualRunning}
            >
              {accrualRunning ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
              Run Daily Accrual
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<PostIcon />}
              onClick={handleRunMonthlyPosting}
              disabled={postingRunning}
            >
              {postingRunning ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
              Post Monthly Interest
            </Button>
          </Stack>

          {accrualMsg && (
            <Alert
              severity={accrualMsg.includes('failed') ? 'error' : 'success'}
              sx={{ mb: 2 }}
              onClose={() => setAccrualMsg('')}
            >
              {accrualMsg}
            </Alert>
          )}

          {postingResult && (
            <Alert severity="info" sx={{ mb: 2 }} onClose={() => setPostingResult(null)}>
              Monthly posting complete — Period: <strong>{postingResult.period}</strong>,
              Accounts: <strong>{postingResult.accountsPosted}</strong>,
              Interest: <strong>{INR(postingResult.totalInterest)}</strong>,
              TDS: <strong>{INR(postingResult.totalTds)}</strong>
            </Alert>
          )}

          {accrualError && <Alert severity="error" sx={{ mb: 2 }}>{accrualError}</Alert>}

          {/* Summary stats */}
          {!accrualLoading && accrualData.length > 0 && (() => {
            const totalInt   = accrualData.reduce((s, d) => s + d.totalInterest, 0);
            const totalAccts = accrualData.reduce((s, d) => s + d.accountCount,  0);
            return (
              <Stack direction="row" spacing={3} sx={{ mb: 3, flexWrap: 'wrap' }}>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
                  <Typography variant="caption" color="text.secondary">Total Accrued</Typography>
                  <Typography variant="h6" fontWeight={700} color="primary">{INR(totalInt)}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
                  <Typography variant="caption" color="text.secondary">Accrual Days</Typography>
                  <Typography variant="h6" fontWeight={700}>{Array.from(new Set(accrualData.map(d => d.date))).length}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
                  <Typography variant="caption" color="text.secondary">Accounts Earning</Typography>
                  <Typography variant="h6" fontWeight={700}>{totalAccts}</Typography>
                </Paper>
              </Stack>
            );
          })()}

          {/* Daily accrual bar chart */}
          {accrualLoading ? (
            <Stack spacing={1}>{[1,2,3].map(i => <Skeleton key={i} height={40} />)}</Stack>
          ) : accrualData.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <TrendingUpIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">
                No accrual records found for the selected date range.
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Daily Accrual (INR)
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={accrualData.map(d => ({
                  date:     String(d.date).slice(0, 10),
                  interest: Number(d.totalInterest.toFixed(2)),
                  accounts: d.accountCount,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={(v: number) => INR(v)} />
                  <Legend />
                  <Bar dataKey="interest" fill="#1976d2" name="Interest (INR)" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </TabPanel>
      </Paper>

      {/* ── Review Alert Dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={!!reviewAlert}
        onClose={() => { setReviewAlert(null); setReviewError(''); setReviewNotes(''); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {reviewAction === 'FILED' ? 'File Compliance Alert' : 'Dismiss Compliance Alert'}
        </DialogTitle>
        <DialogContent>
          {reviewAlert && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Journal: <strong>{reviewAlert.journalNumber}</strong> — Amount:{' '}
                <strong>{INR(reviewAlert.triggerAmount)}</strong>
              </Typography>
            </Box>
          )}
          {reviewError && <Alert severity="error" sx={{ mb: 2 }}>{reviewError}</Alert>}
          <TextField
            label="Notes (optional)"
            multiline
            minRows={3}
            fullWidth
            value={reviewNotes}
            onChange={e => setReviewNotes(e.target.value)}
            placeholder="Add any relevant notes..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setReviewAlert(null); setReviewNotes(''); setReviewError(''); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={reviewAction === 'FILED' ? 'success' : 'inherit'}
            onClick={submitReview}
            disabled={reviewLoading}
          >
            {reviewLoading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            Confirm {reviewAction === 'FILED' ? 'Filing' : 'Dismissal'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Reports;

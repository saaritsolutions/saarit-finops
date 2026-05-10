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
  WarningAmber as WarningAmberIcon,
  Autorenew as AutorenewIcon,
  ThumbUp as ThumbUpIcon,
  Description as DescriptionIcon,
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
import {
  getOverdueLoans,
  getRestructuredLoans,
  getUpgradedLoans,
  getRegulatoryMetrics,
  type OverdueLoanItem,
  type RestructuredLoanItem,
  type UpgradedLoanItem,
  type RegulatoryMetrics,
} from '../../services/loanOriginationService';

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

  // ── Tab 4 — Overdue Loans (SAAR-LRP-002) ─────────────────────────────────
  const [overdueLoans, setOverdueLoans]           = useState<OverdueLoanItem[]>([]);
  const [overdueTotal, setOverdueTotal]           = useState(0);
  const [overdueLoading, setOverdueLoading]       = useState(false);
  const [smaFilter, setSmaFilter]                 = useState('ALL');

  // ── Tab 5 — Restructured Loans (SAAR-LRP-003) ────────────────────────────
  const [restructuredLoans, setRestructuredLoans]     = useState<RestructuredLoanItem[]>([]);
  const [restructuredTotal, setRestructuredTotal]     = useState(0);
  const [restructuredLoading, setRestructuredLoading] = useState(false);

  // ── Tab 6 — Upgraded Loans (SAAR-LRP-004) ───────────────────────────────
  const [upgradedLoans, setUpgradedLoans]             = useState<UpgradedLoanItem[]>([]);
  const [upgradedTotal, setUpgradedTotal]             = useState(0);
  const [upgradedLoading, setUpgradedLoading]         = useState(false);

  // ── Tab 7 — RBI Regulatory Reporting (SAAR-RPT-002) ──────────────────────
  const [regulatoryMetrics, setRegulatoryMetrics]     = useState<RegulatoryMetrics | null>(null);
  const [regulatoryLoading, setRegulatoryLoading]     = useState(false);

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

  const loadOverdue = useCallback(() => {
    setOverdueLoading(true);
    getOverdueLoans({ smaStatus: smaFilter === 'ALL' ? undefined : smaFilter })
      .then(r => { setOverdueLoans(r.items); setOverdueTotal(r.total); })
      .catch(() => { setOverdueLoans([]); setOverdueTotal(0); })
      .finally(() => setOverdueLoading(false));
  }, [smaFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRestructured = useCallback(() => {
    setRestructuredLoading(true);
    getRestructuredLoans()
      .then(r => { setRestructuredLoans(r.items); setRestructuredTotal(r.total); })
      .catch(() => { setRestructuredLoans([]); setRestructuredTotal(0); })
      .finally(() => setRestructuredLoading(false));
  }, []);

  const loadUpgraded = useCallback(() => {
    setUpgradedLoading(true);
    getUpgradedLoans()
      .then(r => { setUpgradedLoans(r.items); setUpgradedTotal(r.total); })
      .catch(() => { setUpgradedLoans([]); setUpgradedTotal(0); })
      .finally(() => setUpgradedLoading(false));
  }, []);

  const loadRegulatoryMetrics = useCallback(() => {
    setRegulatoryLoading(true);
    getRegulatoryMetrics()
      .then(setRegulatoryMetrics)
      .catch(() => setRegulatoryMetrics(null))
      .finally(() => setRegulatoryLoading(false));
  }, []);

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

  useEffect(() => {
    if (tab === 4) loadOverdue();
  }, [tab, smaFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 5) loadRestructured();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 6) loadUpgraded();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 7) loadRegulatoryMetrics();
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

  function exportOverdueCsv() {
    const header = 'Application No,Applicant,Product,Outstanding,Overdue Days,SMA Status,Next Due Date\n';
    const rows   = overdueLoans.map(l =>
      `${l.applicationNumber},${l.applicantName},${l.productType},${l.outstandingPrincipal ?? ''},${l.overdueDays},${l.smaStatus},${l.nextDueDate ? String(l.nextDueDate).slice(0, 10) : ''}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'overdue-loans.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportRestructuredCsv() {
    const header = 'Application No,Applicant,Product,Outstanding,SMA Status,DPD,Restructured Date,New EMI,New Tenure,New Rate,Required Provisioning\n';
    const rows   = restructuredLoans.map(l =>
      `${l.applicationNumber},${l.applicantName},${l.productType},${l.outstandingPrincipal},${l.smaStatus},${l.overdueDays},${l.restructuredDate ? String(l.restructuredDate).slice(0, 10) : ''},${l.restructuredNewEmi ?? ''},${l.restructuredNewTenureMonths ?? ''},${l.restructuredNewInterestRate ?? ''},${l.requiredProvisioning}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'restructured-loans.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportUpgradedCsv() {
    const header = 'Application No,Applicant,Product,Outstanding,Original Tenure,Original Rate,Upgraded Date\n';
    const rows   = upgradedLoans.map(l =>
      `${l.applicationNumber},${l.applicantName},${l.productType},${l.outstandingPrincipal},${l.originalTenureMonths ?? ''},${l.originalInterestRate ?? ''},${l.upgradedDate ? String(l.upgradedDate).slice(0, 10) : ''}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'upgraded-loans.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function smaColor(s: string): 'success' | 'warning' | 'error' | 'default' {
    if (s === 'STANDARD') return 'success';
    if (s === 'SMA-0' || s === 'SMA-1') return 'warning';
    if (s === 'SMA-2' || s === 'NPA')   return 'error';
    return 'default';
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
          <Tab icon={<WarningAmberIcon fontSize="small" />} iconPosition="start" label="Overdue Loans"    id="rpt-tab-4" />
          <Tab icon={<AutorenewIcon    fontSize="small" />} iconPosition="start" label="Restructured"     id="rpt-tab-5" />
          <Tab icon={<ThumbUpIcon      fontSize="small" />} iconPosition="start" label="Loan Upgrades"    id="rpt-tab-6" />
          <Tab icon={<DescriptionIcon  fontSize="small" />} iconPosition="start" label="RBI Regulatory"   id="rpt-tab-7" />
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

        {/* ── Tab 4: Overdue Loans (SAAR-LRP-002) ─────────────────────────────── */}
        <TabPanel value={tab} index={4}>
          {/* Header row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningAmberIcon color="warning" /> Overdue Loans ({overdueTotal})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {(['ALL', 'SMA-0', 'SMA-1', 'SMA-2', 'NPA'] as const).map(s => (
                <Chip
                  key={s}
                  label={s}
                  size="small"
                  variant={smaFilter === s ? 'filled' : 'outlined'}
                  color={s === 'ALL' ? 'default' : smaColor(s)}
                  onClick={() => setSmaFilter(s)}
                  aria-label={`filter ${s}`}
                />
              ))}
              <Button
                variant="outlined" size="small" startIcon={<DownloadIcon />}
                onClick={exportOverdueCsv} disabled={overdueLoans.length === 0}
                aria-label="Export Overdue CSV"
              >Export CSV</Button>
            </Box>
          </Box>

          {/* Summary stats chips */}
          {overdueLoans.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {(['SMA-0', 'SMA-1', 'SMA-2', 'NPA'] as const).map(band => {
                const count = overdueLoans.filter(l => l.smaStatus === band).length;
                return count > 0 ? (
                  <Chip key={band} label={`${band}: ${count}`} color={smaColor(band)} size="small" />
                ) : null;
              })}
            </Box>
          )}

          {/* Table */}
          {overdueLoading ? (
            <Stack spacing={1}>{[1, 2, 3, 4].map(i => <Skeleton key={i} height={40} />)}</Stack>
          ) : overdueLoans.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No overdue loans — all accounts are current.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                    <TableCell>Application No</TableCell>
                    <TableCell>Applicant</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Outstanding (₹)</TableCell>
                    <TableCell align="right">Overdue Days</TableCell>
                    <TableCell>SMA Status</TableCell>
                    <TableCell>Next Due</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overdueLoans.map(l => (
                    <TableRow key={l.id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{l.applicationNumber}</TableCell>
                      <TableCell>{l.applicantName}</TableCell>
                      <TableCell>{l.productType.replace(/_/g, ' ')}</TableCell>
                      <TableCell align="right">{l.outstandingPrincipal != null ? INR(l.outstandingPrincipal) : '—'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: l.overdueDays > 60 ? 'error.main' : 'warning.main' }}>
                        {l.overdueDays}
                      </TableCell>
                      <TableCell><Chip label={l.smaStatus} color={smaColor(l.smaStatus)} size="small" /></TableCell>
                      <TableCell>{l.nextDueDate ? String(l.nextDueDate).slice(0, 10) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* ── Tab 5: Restructured Loans (SAAR-LRP-003) ─────────────────────────── */}
        <TabPanel value={tab} index={5}>
          {/* Header row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutorenewIcon color="warning" /> Restructured Loans ({restructuredTotal})
            </Typography>
            <Button
              variant="outlined" size="small" startIcon={<DownloadIcon />}
              onClick={exportRestructuredCsv} disabled={restructuredLoans.length === 0}
              aria-label="Export Restructured CSV"
            >Export CSV</Button>
          </Box>

          {/* KPI row */}
          {!restructuredLoading && restructuredLoans.length > 0 && (() => {
            const totalOutstanding   = restructuredLoans.reduce((s, l) => s + l.outstandingPrincipal, 0);
            const totalProvisioning  = restructuredLoans.reduce((s, l) => s + l.requiredProvisioning, 0);
            return (
              <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
                  <Typography variant="caption" color="text.secondary">Restructured Count</Typography>
                  <Typography variant="h6" fontWeight={700} color="warning.main">{restructuredTotal}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
                  <Typography variant="caption" color="text.secondary">Total Outstanding</Typography>
                  <Typography variant="h6" fontWeight={700}>{INR(totalOutstanding)}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 180 }}>
                  <Typography variant="caption" color="text.secondary">Required Provisioning (5%)</Typography>
                  <Typography variant="h6" fontWeight={700} color="error.main">{INR(totalProvisioning)}</Typography>
                </Paper>
              </Stack>
            );
          })()}

          {/* Table */}
          {restructuredLoading ? (
            <Stack spacing={1}>{[1, 2, 3].map(i => <Skeleton key={i} height={40} />)}</Stack>
          ) : restructuredLoans.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No restructured loans on record.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                    <TableCell>Application No</TableCell>
                    <TableCell>Applicant</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Outstanding (₹)</TableCell>
                    <TableCell>SMA Status</TableCell>
                    <TableCell align="right">DPD</TableCell>
                    <TableCell>Restructured Date</TableCell>
                    <TableCell align="right">New EMI (₹)</TableCell>
                    <TableCell align="right">Required Prov. (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {restructuredLoans.map(l => (
                    <TableRow key={l.id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{l.applicationNumber}</TableCell>
                      <TableCell>{l.applicantName}</TableCell>
                      <TableCell>{l.productType.replace(/_/g, ' ')}</TableCell>
                      <TableCell align="right">{INR(l.outstandingPrincipal)}</TableCell>
                      <TableCell>
                        <Chip label={l.smaStatus} color={smaColor(l.smaStatus)} size="small" />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: l.overdueDays > 60 ? 'error.main' : 'warning.main' }}>
                        {l.overdueDays}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {l.restructuredDate ? String(l.restructuredDate).slice(0, 10) : '—'}
                      </TableCell>
                      <TableCell align="right">{l.restructuredNewEmi != null ? INR(l.restructuredNewEmi) : '—'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: 'error.main' }}>
                        {INR(l.requiredProvisioning)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* ── Tab 6: Loan Upgrades (SAAR-LRP-004) ────────────────────────────── */}
        <TabPanel value={tab} index={6}>
          {/* Header row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ThumbUpIcon color="success" /> Loan Upgrades ({upgradedTotal})
            </Typography>
            <Button
              variant="outlined" size="small" startIcon={<DownloadIcon />}
              onClick={exportUpgradedCsv} disabled={upgradedLoans.length === 0}
              aria-label="Export Upgraded CSV"
            >Export CSV</Button>
          </Box>

          {/* KPI row */}
          {!upgradedLoading && upgradedLoans.length > 0 && (() => {
            const totalOutstanding = upgradedLoans.reduce((s, l) => s + l.outstandingPrincipal, 0);
            return (
              <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
                  <Typography variant="caption" color="text.secondary">Upgraded Count</Typography>
                  <Typography variant="h6" fontWeight={700} color="success.main">{upgradedTotal}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
                  <Typography variant="caption" color="text.secondary">Total Outstanding</Typography>
                  <Typography variant="h6" fontWeight={700}>{INR(totalOutstanding)}</Typography>
                </Paper>
              </Stack>
            );
          })()}

          {/* Table */}
          {upgradedLoading ? (
            <Stack spacing={1}>{[1, 2, 3].map(i => <Skeleton key={i} height={40} />)}</Stack>
          ) : upgradedLoans.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No upgraded loans on record.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                    <TableCell>Application No</TableCell>
                    <TableCell>Applicant</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Outstanding (₹)</TableCell>
                    <TableCell align="right">Original Tenure (months)</TableCell>
                    <TableCell align="right">Original Rate (% p.a.)</TableCell>
                    <TableCell>Upgraded Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {upgradedLoans.map(l => (
                    <TableRow key={l.id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{l.applicationNumber}</TableCell>
                      <TableCell>{l.applicantName}</TableCell>
                      <TableCell>{l.productType.replace(/_/g, ' ')}</TableCell>
                      <TableCell align="right">{INR(l.outstandingPrincipal)}</TableCell>
                      <TableCell align="right">{l.originalTenureMonths ?? '—'}</TableCell>
                      <TableCell align="right">{l.originalInterestRate != null ? `${l.originalInterestRate}%` : '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {l.upgradedDate ? String(l.upgradedDate).slice(0, 10) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* ── Tab 7: RBI Regulatory Reporting (SAAR-RPT-002) ───────────────────── */}
        <TabPanel value={tab} index={7}>
          {/* Header row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon color="info" /> RBI Regulatory Summary
            </Typography>
            <Button
              variant="outlined" size="small" startIcon={<DownloadIcon />}
              onClick={() => {
                if (!regulatoryMetrics) return;
                const csv = [
                  ['Regulatory Metrics Report', `As of ${regulatoryMetrics.asOfDate}`],
                  [],
                  ['Metric', 'Value'],
                  ['Total Loan Book (₹)', INR(regulatoryMetrics.totalLoanBook)],
                  ['Total NPA Outstanding (₹)', INR(regulatoryMetrics.totalNpaOutstanding)],
                  ['NPA Ratio (%)', regulatoryMetrics.npaRatio.toFixed(2)],
                  ['Total Required Provisioning (₹)', INR(regulatoryMetrics.totalRequiredProvisioning)],
                  ['Provision Coverage (%)', regulatoryMetrics.provisionCoverage.toFixed(2)],
                  [],
                  ['Restructured Count', regulatoryMetrics.restructuredCount.toString()],
                  ['Restructured Outstanding (₹)', INR(regulatoryMetrics.restructuredOutstanding)],
                  ['Restructured Ratio (%)', regulatoryMetrics.restructuredRatio.toFixed(2)],
                  [],
                  ['Upgraded Count', regulatoryMetrics.upgradedCount.toString()],
                  ['Upgraded Outstanding (₹)', INR(regulatoryMetrics.upgradedOutstanding)],
                  [],
                  ['Written-Off Count', regulatoryMetrics.writtenOffCount.toString()],
                  ['Written-Off Outstanding (₹)', INR(regulatoryMetrics.writtenOffOutstanding)],
                  [],
                  ['SMA Watch Count', regulatoryMetrics.smaWatchCount.toString()],
                  ['SMA Watch Outstanding (₹)', INR(regulatoryMetrics.smaWatchOutstanding)],
                  [],
                  ['Standard Count', regulatoryMetrics.standardCount.toString()],
                  ['Standard Outstanding (₹)', INR(regulatoryMetrics.standardOutstanding)],
                ]
                  .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
                  .join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `regulatory-report-${regulatoryMetrics.asOfDate}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={!regulatoryMetrics}
              aria-label="Export Regulatory CSV"
            >Export CSV</Button>
          </Box>

          {/* As-of date */}
          {regulatoryMetrics && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              As of: <strong>{regulatoryMetrics.asOfDate}</strong>
            </Typography>
          )}

          {/* KPI Row 1: Core Metrics */}
          {regulatoryLoading ? (
            <Stack spacing={1}>{[1, 2, 3, 4].map(i => <Skeleton key={i} height={80} />)}</Stack>
          ) : regulatoryMetrics ? (
            <>
              <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 180 }}>
                  <Typography variant="caption" color="text.secondary">Total Loan Book</Typography>
                  <Typography variant="h6" fontWeight={700}>{INR(regulatoryMetrics.totalLoanBook)}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 180 }}>
                  <Typography variant="caption" color="text.secondary">NPA Outstanding</Typography>
                  <Typography variant="h6" fontWeight={700} color={regulatoryMetrics.npaRatio > 0 ? 'error.main' : 'success.main'}>
                    {INR(regulatoryMetrics.totalNpaOutstanding)}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 180 }}>
                  <Typography variant="caption" color="text.secondary">NPA Ratio (%)</Typography>
                  <Typography variant="h6" fontWeight={700} color={regulatoryMetrics.npaRatio > 5 ? 'error.main' : regulatoryMetrics.npaRatio > 2 ? 'warning.main' : 'success.main'}>
                    {regulatoryMetrics.npaRatio.toFixed(2)}%
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 180 }}>
                  <Typography variant="caption" color="text.secondary">Provision Coverage (%)</Typography>
                  <Typography variant="h6" fontWeight={700} color={regulatoryMetrics.provisionCoverage < 100 ? 'warning.main' : 'success.main'}>
                    {regulatoryMetrics.provisionCoverage.toFixed(2)}%
                  </Typography>
                </Paper>
              </Stack>

              {/* KPI Row 2: Loan Categories */}
              <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 180 }}>
                  <Typography variant="caption" color="text.secondary">Restructured Count</Typography>
                  <Typography variant="h6" fontWeight={700}>{regulatoryMetrics.restructuredCount}</Typography>
                  <Typography variant="caption" color="text.secondary">{INR(regulatoryMetrics.restructuredOutstanding)}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 180 }}>
                  <Typography variant="caption" color="text.secondary">Upgraded Count</Typography>
                  <Typography variant="h6" fontWeight={700}>{regulatoryMetrics.upgradedCount}</Typography>
                  <Typography variant="caption" color="text.secondary">{INR(regulatoryMetrics.upgradedOutstanding)}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 180 }}>
                  <Typography variant="caption" color="text.secondary">Written-Off Count</Typography>
                  <Typography variant="h6" fontWeight={700} color="error.main">{regulatoryMetrics.writtenOffCount}</Typography>
                  <Typography variant="caption" color="text.secondary">{INR(regulatoryMetrics.writtenOffOutstanding)}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, minWidth: 180 }}>
                  <Typography variant="caption" color="text.secondary">SMA Watch Count</Typography>
                  <Typography variant="h6" fontWeight={700} color="warning.main">{regulatoryMetrics.smaWatchCount}</Typography>
                  <Typography variant="caption" color="text.secondary">{INR(regulatoryMetrics.smaWatchOutstanding)}</Typography>
                </Paper>
              </Stack>

              {/* Summary table */}
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
                      <TableCell>Loan Category</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell align="right">Outstanding (₹)</TableCell>
                      <TableCell align="right">% of Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow hover>
                      <TableCell>Standard</TableCell>
                      <TableCell align="right">{regulatoryMetrics.standardCount}</TableCell>
                      <TableCell align="right">{INR(regulatoryMetrics.standardOutstanding)}</TableCell>
                      <TableCell align="right">
                        {regulatoryMetrics.totalLoanBook > 0
                          ? ((regulatoryMetrics.standardOutstanding / regulatoryMetrics.totalLoanBook) * 100).toFixed(2)
                          : '0.00'}%
                      </TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell>SMA Watch</TableCell>
                      <TableCell align="right">{regulatoryMetrics.smaWatchCount}</TableCell>
                      <TableCell align="right">{INR(regulatoryMetrics.smaWatchOutstanding)}</TableCell>
                      <TableCell align="right">
                        {regulatoryMetrics.totalLoanBook > 0
                          ? ((regulatoryMetrics.smaWatchOutstanding / regulatoryMetrics.totalLoanBook) * 100).toFixed(2)
                          : '0.00'}%
                      </TableCell>
                    </TableRow>
                    <TableRow hover sx={{ bgcolor: 'error.lighter' }}>
                      <TableCell sx={{ fontWeight: 600 }}>NPA</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>—</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{INR(regulatoryMetrics.totalNpaOutstanding)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {regulatoryMetrics.npaRatio.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell>Restructured</TableCell>
                      <TableCell align="right">{regulatoryMetrics.restructuredCount}</TableCell>
                      <TableCell align="right">{INR(regulatoryMetrics.restructuredOutstanding)}</TableCell>
                      <TableCell align="right">
                        {regulatoryMetrics.totalLoanBook > 0
                          ? ((regulatoryMetrics.restructuredOutstanding / regulatoryMetrics.totalLoanBook) * 100).toFixed(2)
                          : '0.00'}%
                      </TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell>Upgraded</TableCell>
                      <TableCell align="right">{regulatoryMetrics.upgradedCount}</TableCell>
                      <TableCell align="right">{INR(regulatoryMetrics.upgradedOutstanding)}</TableCell>
                      <TableCell align="right">—</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell>Written-Off</TableCell>
                      <TableCell align="right">{regulatoryMetrics.writtenOffCount}</TableCell>
                      <TableCell align="right">{INR(regulatoryMetrics.writtenOffOutstanding)}</TableCell>
                      <TableCell align="right">—</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No regulatory metrics available.
            </Typography>
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

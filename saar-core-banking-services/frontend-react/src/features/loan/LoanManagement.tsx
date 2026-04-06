import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider,
  IconButton, InputAdornment, MenuItem, Paper, Stack,
  Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, Tabs, TextField,
  Tooltip, Typography,
} from '@mui/material';
import AddIcon          from '@mui/icons-material/Add';
import SearchIcon       from '@mui/icons-material/Search';
import RefreshIcon      from '@mui/icons-material/Refresh';
import DownloadIcon     from '@mui/icons-material/Download';
import VisibilityIcon   from '@mui/icons-material/Visibility';
import FilterListIcon   from '@mui/icons-material/FilterList';
import PendingIcon      from '@mui/icons-material/PendingActions';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import ScheduleIcon     from '@mui/icons-material/Schedule';
import { useNavigate }  from 'react-router-dom';
import PageHeader       from '../../components/common/PageHeader';
import {
  getApplicationsList, getPendingApprovalList,
  type ApplicationSummary,
} from '../../services/loanOriginationService';

// ── Design tokens ────────────────────────────────────────────────────────────
const BLUE_600  = '#2563EB';
const SLATE_50  = '#F8FAFC';
const SLATE_200 = '#E2E8F0';

// ── Helpers ──────────────────────────────────────────────────────────────────
const INR = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
};

const fmtAge = (iso: string) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days}d ago`;
};

type StatusKey = 'ALL' | 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'CREDIT_APPROVED' | 'APPROVED' | 'REJECTED' | 'DISBURSED';

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

const PRODUCTS = ['ALL', 'PERSONAL_LOAN', 'HOME_LOAN', 'BUSINESS_LOAN', 'GOLD_LOAN', 'VEHICLE_LOAN'];
const PRODUCT_LABELS: Record<string, string> = {
  ALL: 'All Products', PERSONAL_LOAN: 'Personal', HOME_LOAN: 'Home',
  BUSINESS_LOAN: 'Business', GOLD_LOAN: 'Gold', VEHICLE_LOAN: 'Vehicle',
};

// ── Status chip ──────────────────────────────────────────────────────────────
const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'default' as const };
  return <Chip label={cfg.label} size="small" color={cfg.color} sx={{ fontWeight: 600, fontSize: '0.72rem' }} />;
};

// ── CIBIL badge ──────────────────────────────────────────────────────────────
const CibilBadge: React.FC<{ score?: number | null }> = ({ score }) => {
  if (!score) return <Typography variant="body2" color="text.disabled">—</Typography>;
  const color = score >= 750 ? '#10B981' : score >= 700 ? '#F59E0B' : '#EF4444';
  return (
    <Typography variant="body2" sx={{ fontWeight: 700, color, fontFamily: 'monospace' }}>
      {score}
    </Typography>
  );
};

// ── Export CSV helper ─────────────────────────────────────────────────────────
const exportCSV = (rows: ApplicationSummary[]) => {
  const header = 'Application No,Applicant,Mobile,Product,Amount,Tenure,Rate,CIBIL,FOIR,Status,Applied On';
  const body = rows.map(r => [
    r.applicationNumber, r.applicantName, r.mobileNumber ?? '',
    r.productType, r.requestedAmount, `${r.tenureMonths}mo`,
    r.interestRate ? `${r.interestRate}%` : '', r.cibilScore ?? '',
    r.foirPercent ? `${r.foirPercent.toFixed(1)}%` : '',
    r.status, fmtDate(r.createdAt),
  ].map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'loan_applications.csv'; a.click();
  URL.revokeObjectURL(url);
};

// ── Main Component ────────────────────────────────────────────────────────────
const LoanManagement: React.FC = () => {
  const navigate = useNavigate();

  // ── All Applications tab state ───────────────────────────────────────────
  const [apps, setApps]         = useState<ApplicationSummary[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);            // 0-indexed for MUI
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusKey>('ALL');
  const [productFilter, setProductFilter] = useState('ALL');
  const [search, setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');

  // ── Pending Approvals tab state ──────────────────────────────────────────
  const [pending, setPending]       = useState<ApplicationSummary[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // ── Tab ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState(0);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getApplicationsList({
        status:      statusFilter === 'ALL' ? undefined : statusFilter,
        search:      search || undefined,
        productType: productFilter === 'ALL' ? undefined : productFilter,
        page:        page + 1,
        pageSize,
      });
      setApps(result.items);
      setTotal(result.total);
    } catch {
      setError('Failed to load loan applications. Check that LoanService is running on port 5130.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, productFilter, page, pageSize]);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const items = await getPendingApprovalList();
      setPending(items);
    } catch {
      /* silently fail */
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);
  useEffect(() => { if (tab === 1) loadPending(); }, [tab, loadPending]);

  // Search on Enter / debounce
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { setSearch(searchInput); setPage(0); }
  };

  // ── Status filter counts ─────────────────────────────────────────────────
  const STATUS_FILTERS: StatusKey[] = ['ALL', 'SUBMITTED', 'IN_REVIEW', 'CREDIT_APPROVED', 'APPROVED', 'REJECTED', 'DRAFT', 'DISBURSED'];

  const ApplicationTable: React.FC<{ rows: ApplicationSummary[]; showLoading: boolean }> = ({ rows, showLoading }) => (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: SLATE_50, borderBottom: `2px solid ${SLATE_200}`, py: 1.2 } }}>
            <TableCell>Application #</TableCell>
            <TableCell>Applicant</TableCell>
            <TableCell>Product</TableCell>
            <TableCell align="right">Amount (₹)</TableCell>
            <TableCell align="center">Tenure</TableCell>
            <TableCell align="center">Rate</TableCell>
            <TableCell align="center">CIBIL</TableCell>
            <TableCell align="center">FOIR</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Applied</TableCell>
            <TableCell align="center">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {showLoading ? (
            <TableRow>
              <TableCell colSpan={11} align="center" sx={{ py: 6 }}>
                <CircularProgress size={28} />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} align="center" sx={{ py: 8 }}>
                <Stack alignItems="center" spacing={1}>
                  <Typography variant="body1" color="text.secondary">No loan applications found</Typography>
                  <Typography variant="body2" color="text.disabled">
                    Try adjusting your filters or{' '}
                    <Button size="small" variant="text" onClick={() => navigate('/loans/new')}>
                      create a new application
                    </Button>
                  </Typography>
                </Stack>
              </TableCell>
            </TableRow>
          ) : (
            rows.map(app => (
              <TableRow
                key={app.id} hover
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#EFF6FF' } }}
                onClick={() => navigate(`/loans/${app.id}`)}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: BLUE_600, fontSize: '0.78rem' }}>
                    {app.applicationNumber || app.id.slice(0, 8) + '…'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>{app.applicantName || '—'}</Typography>
                  {app.mobileNumber && (
                    <Typography variant="caption" color="text.secondary">{app.mobileNumber}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={PRODUCT_LABELS[app.productType] ?? app.productType} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    ₹{INR(app.requestedAmount)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">{app.tenureMonths}mo</Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">{app.interestRate ? `${app.interestRate}%` : '—'}</Typography>
                </TableCell>
                <TableCell align="center"><CibilBadge score={app.cibilScore} /></TableCell>
                <TableCell align="center">
                  {app.foirPercent != null ? (
                    <Typography variant="body2" sx={{ color: (app.foirPercent ?? 0) > 50 ? '#EF4444' : '#10B981', fontWeight: 600 }}>
                      {typeof app.foirPercent === 'number' ? app.foirPercent.toFixed(1) : app.foirPercent}%
                    </Typography>
                  ) : <Typography variant="body2" color="text.disabled">—</Typography>}
                </TableCell>
                <TableCell><StatusChip status={app.status} /></TableCell>
                <TableCell>
                  <Tooltip title={fmtDate(app.createdAt)}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                      {fmtAge(app.createdAt)}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell align="center" onClick={e => e.stopPropagation()}>
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => navigate(`/loans/${app.id}`)} sx={{ color: BLUE_600 }}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box>
      <PageHeader
        title="Loan Applications"
        subtitle="Manage and track all loan applications across the bank"
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined" size="small" startIcon={<DownloadIcon />}
              onClick={() => exportCSV(apps)}
              sx={{ borderColor: SLATE_200 }}
            >
              Export CSV
            </Button>
            <Button
              variant="contained" startIcon={<AddIcon />}
              onClick={() => navigate('/loans/new')}
            >
              New Application
            </Button>
          </Stack>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: `1px solid ${SLATE_200}` }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, minHeight: 48 }}>
            <Tab icon={<FilterListIcon fontSize="small" />} iconPosition="start" label="All Applications" sx={{ minHeight: 48, textTransform: 'none', fontWeight: 500 }} />
            <Tab
              icon={<PendingIcon fontSize="small" />} iconPosition="start"
              label={`Pending Approval${pending.length > 0 ? ` (${pending.length})` : ''}`}
              sx={{ minHeight: 48, textTransform: 'none', fontWeight: 500 }}
            />
          </Tabs>
        </Box>

        {/* ── All Applications Tab ─────────────────────────────────────────── */}
        {tab === 0 && (
          <Box>
            {/* Filters */}
            <Box sx={{ p: 2, borderBottom: `1px solid ${SLATE_200}`, bgcolor: SLATE_50 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                {/* Search */}
                <TextField
                  placeholder="Search by name, application #, mobile..."
                  size="small"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} /></InputAdornment> }}
                  sx={{ minWidth: 280 }}
                />

                {/* Product filter */}
                <TextField
                  select size="small" value={productFilter}
                  onChange={e => { setProductFilter(e.target.value); setPage(0); }}
                  sx={{ minWidth: 160 }}
                  label="Product"
                >
                  {PRODUCTS.map(p => (
                    <MenuItem key={p} value={p}>{PRODUCT_LABELS[p]}</MenuItem>
                  ))}
                </TextField>

                {/* Refresh */}
                <Tooltip title="Refresh">
                  <IconButton onClick={loadApps} size="small">
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Box sx={{ flex: 1 }} />

                {/* Total count */}
                <Typography variant="body2" color="text.secondary">
                  {total} application{total !== 1 ? 's' : ''}
                </Typography>
              </Stack>

              {/* Status filter chips */}
              <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap" useFlexGap>
                {STATUS_FILTERS.map(s => (
                  <Chip
                    key={s}
                    label={s === 'ALL' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
                    size="small"
                    variant={statusFilter === s ? 'filled' : 'outlined'}
                    color={statusFilter === s ? (s === 'ALL' ? 'primary' : STATUS_CONFIG[s]?.color ?? 'default') : 'default'}
                    onClick={() => { setStatusFilter(s); setPage(0); }}
                    sx={{ cursor: 'pointer', fontWeight: statusFilter === s ? 600 : 400 }}
                  />
                ))}
              </Stack>
            </Box>

            {/* Table */}
            <ApplicationTable rows={apps} showLoading={loading} />

            {/* Pagination */}
            <Divider />
            <TablePagination
              component="div"
              count={total}
              page={page}
              rowsPerPage={pageSize}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50]}
            />
          </Box>
        )}

        {/* ── Pending Approvals Tab ────────────────────────────────────────── */}
        {tab === 1 && (
          <Box>
            <Box sx={{ p: 2, borderBottom: `1px solid ${SLATE_200}`, bgcolor: SLATE_50, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ScheduleIcon fontSize="small" sx={{ color: '#F59E0B' }} />
                <Typography variant="body2" fontWeight={600} color="text.secondary">
                  Applications requiring credit officer or manager action
                </Typography>
              </Stack>
              <Tooltip title="Refresh">
                <IconButton onClick={loadPending} size="small">
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            {pending.length === 0 && !pendingLoading ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 48, color: '#10B981', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">No pending approvals — all caught up!</Typography>
              </Box>
            ) : (
              <ApplicationTable rows={pending} showLoading={pendingLoading} />
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default LoanManagement;

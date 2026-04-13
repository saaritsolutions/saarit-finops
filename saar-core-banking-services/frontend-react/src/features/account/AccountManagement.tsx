import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  InputAdornment,
  useTheme,
} from '@mui/material';
import AddIcon          from '@mui/icons-material/Add';
import EditIcon         from '@mui/icons-material/Edit';
import DeleteIcon       from '@mui/icons-material/Delete';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import LockIcon         from '@mui/icons-material/Lock';
import LockOpenIcon     from '@mui/icons-material/LockOpen';
import AcUnitIcon       from '@mui/icons-material/AcUnit';
import SearchIcon       from '@mui/icons-material/Search';
import AccountBoxIcon   from '@mui/icons-material/AccountBox';
import SavingsIcon      from '@mui/icons-material/Savings';
import MoneyOffIcon     from '@mui/icons-material/MoneyOff';
import PaymentsIcon     from '@mui/icons-material/Payments';
import { accountService, AccountRecord, CreateAccountDto, MatureResult, PrematureCloseResult } from '../../services/accountService';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import JournalDetailDialog from '../../components/dialogs/JournalDetailDialog';

// ─── Design tokens ─────────────────────────────────────────────────────────
const SLATE_200 = '#E2E8F0';
const SLATE_400 = '#94A3B8';
const SLATE_500 = '#64748B';

// ─── Status config ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  Active:   { bg: '#ECFDF5', text: '#059669', border: '#10B98120' },
  Approved: { bg: '#ECFDF5', text: '#059669', border: '#10B98120' },
  Pending:  { bg: '#FFFBEB', text: '#D97706', border: '#F59E0B20' },
  Frozen:   { bg: '#FEF2F2', text: '#DC2626', border: '#EF444420' },
  Closed:   { bg: '#F8FAFC', text: '#64748B', border: '#94A3B820' },
  Rejected: { bg: '#FEF2F2', text: '#DC2626', border: '#EF444420' },
  Mature:   { bg: '#F0F9FF', text: '#0369A1', border: '#0EA5E920' },
  Dormant:  { bg: '#F8FAFC', text: '#475569', border: '#94A3B820' },
};

const StatusChip: React.FC<{ label?: string }> = ({ label = 'Unknown' }) => {
  const cfg = STATUS_CONFIG[label] ?? { bg: '#F8FAFC', text: '#64748B', border: '#94A3B820' };
  return (
    <Box
      component="span"
      sx={{
        display:         'inline-flex',
        alignItems:      'center',
        px:              1,
        py:              0.25,
        borderRadius:    6,
        fontSize:        '0.75rem',
        fontWeight:      600,
        backgroundColor: cfg.bg,
        color:           cfg.text,
        border:          `1px solid ${cfg.border}`,
        letterSpacing:   '0.01em',
      }}
    >
      {label}
    </Box>
  );
};

// ─── Constants ──────────────────────────────────────────────────────────────
const PRODUCT_TYPES = ['Savings', 'Current', 'FD', 'RD', 'NRE', 'NRO', 'FCNR'];
const MODES         = ['SingleOperator', 'JointOperator', 'JointOperatorEither', 'Guardian'];

const BLANK: CreateAccountDto = {
  accountNumber:     '',
  customerId:        0,
  productTypeId:     undefined,
  balance:           0,
  modeOfOperation:   'SingleOperator',
  isMinor:           false,
  legalGuardianName: '',
  branchId:          undefined,
};

type StatusFilter = 'All' | 'Active' | 'Pending' | 'Closed' | 'Frozen' | 'Mature';
const STATUS_FILTERS: StatusFilter[] = ['All', 'Active', 'Pending', 'Closed', 'Frozen', 'Mature'];

// ─── Component ──────────────────────────────────────────────────────────────

const AccountManagement: React.FC = () => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [accounts,      setAccounts]      = useState<AccountRecord[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [dialogOpen,    setDialogOpen]    = useState(false);
  const [editing,       setEditing]       = useState<AccountRecord | null>(null);
  const [form,          setForm]          = useState<CreateAccountDto>(BLANK);
  const [saving,        setSaving]        = useState(false);
  const [actionError,   setActionError]   = useState<string | null>(null);
  const [successMsg,    setSuccessMsg]    = useState<string | null>(null);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('All');
  const [journalNumber, setJournalNumber] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await accountService.list());
    } catch {
      setError('Failed to load accounts — check that AccountService is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = accounts.filter(acc => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q
      || (acc.accountNumber ?? '').toLowerCase().includes(q)
      || String(acc.customerId).includes(q)
      || (acc.productType?.name ?? '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'All' || acc.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Dialog helpers ────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm(BLANK);
    setActionError(null);
    setDialogOpen(true);
  };

  const openEdit = (acc: AccountRecord) => {
    setEditing(acc);
    setForm({
      accountNumber:     acc.accountNumber ?? '',
      customerId:        acc.customerId,
      productTypeId:     acc.productTypeId,
      balance:           acc.balance,
      modeOfOperation:   acc.modeOfOperation ?? 'SingleOperator',
      isMinor:           acc.isMinor ?? false,
      legalGuardianName: '',
      branchId:          acc.branchId,
    });
    setActionError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const handleSave = async () => {
    if (!form.customerId) { setActionError('Customer ID is required.'); return; }
    setSaving(true);
    setActionError(null);
    try {
      if (editing) {
        await accountService.update(editing.accountId, { ...form, accountId: editing.accountId });
      } else {
        await accountService.create(form);
      }
      closeDialog();
      await load();
    } catch (e: any) {
      setActionError(e?.response?.data ?? e?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  // ── Row actions ────────────────────────────────────────────────────────────
  const handleDelete = async (acc: AccountRecord) => {
    if (!window.confirm(`Delete account ${acc.accountNumber ?? acc.accountId}?`)) return;
    try { await accountService.remove(acc.accountId); await load(); }
    catch (e: any) { setError(e?.response?.data ?? e?.message ?? 'Delete failed.'); }
  };

  const handleApprove = async (acc: AccountRecord) => {
    try { await accountService.approve(acc.accountId); await load(); }
    catch (e: any) { setError(e?.response?.data ?? e?.message ?? 'Approve failed.'); }
  };

  const handleClose = async (acc: AccountRecord) => {
    if (!window.confirm(`Close account ${acc.accountNumber ?? acc.accountId}? This cannot be undone.`)) return;
    try { await accountService.close(acc.accountId); await load(); }
    catch (e: any) { setError(e?.response?.data ?? e?.message ?? 'Close failed.'); }
  };

  const handleMature = async (acc: AccountRecord) => {
    const label = acc.accountNumber ?? `Account ${acc.accountId}`;
    if (!window.confirm(`Process maturity for ${label}?\nThis will pay out principal + interest and post a ledger journal.`)) return;
    try {
      const res: MatureResult = await accountService.mature(acc.accountId);
      const detail = res.renewedMaturityDate
        ? `Auto-renewed — next maturity: ${new Date(res.renewedMaturityDate).toLocaleDateString('en-IN')}`
        : `Matured successfully${res.journalNumber ? ` — journal ${res.journalNumber}` : ''}`;
      setSuccessMsg(detail);
      await load();
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? 'Maturity processing failed.');
    }
  };

  const handlePrematureClose = async (acc: AccountRecord) => {
    const label = acc.accountNumber ?? `Account ${acc.accountId}`;
    if (!window.confirm(`Premature closure for ${label}?\nA penalty will be applied. Payout will be less than full maturity amount.`)) return;
    try {
      const res: PrematureCloseResult = await accountService.prematureClose(acc.accountId);
      const detail = `Closed — payout ₹${res.netPayout?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ?? '—'}${res.penaltyAmount ? `, penalty ₹${res.penaltyAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}${res.journalNumber ? ` — journal ${res.journalNumber}` : ''}`;
      setSuccessMsg(detail);
      await load();
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? 'Premature closure failed.');
    }
  };

  const handleFreeze = async (acc: AccountRecord) => {
    if (!window.confirm(`Freeze account ${acc.accountNumber ?? acc.accountId}? No transactions will be permitted while frozen.`)) return;
    try { await accountService.freeze(acc.accountId); setSuccessMsg(`Account ${acc.accountNumber ?? acc.accountId} frozen.`); await load(); }
    catch (e: any) { setError(e?.response?.data ?? e?.message ?? 'Freeze failed.'); }
  };

  const handleUnfreeze = async (acc: AccountRecord) => {
    if (!window.confirm(`Unfreeze account ${acc.accountNumber ?? acc.accountId}? It will be restored to Active status.`)) return;
    try { await accountService.unfreeze(acc.accountId); setSuccessMsg(`Account ${acc.accountNumber ?? acc.accountId} unfrozen.`); await load(); }
    catch (e: any) { setError(e?.response?.data ?? e?.message ?? 'Unfreeze failed.'); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Box>
      <PageHeader
        title="Account Management"
        subtitle="View and manage customer accounts across all product types"
        breadcrumbs={[{ label: 'Banking' }, { label: 'Account Management' }]}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            New Account
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>
      )}

      {/* Filter bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search by account #, customer, product…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16, color: isDark ? SLATE_500 : SLATE_400 }} />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 280 }}
        />
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(s => {
            const active = statusFilter === s;
            const cfg    = s !== 'All' ? (STATUS_CONFIG[s] ?? {}) : null;
            return (
              <Chip
                key={s}
                label={s}
                size="small"
                onClick={() => setStatusFilter(s)}
                sx={{
                  height:          28,
                  fontWeight:      active ? 600 : 500,
                  fontSize:        '0.8125rem',
                  cursor:          'pointer',
                  backgroundColor: active
                    ? (cfg ? cfg.bg : (isDark ? '#1E3A5F' : '#EFF6FF'))
                    : (isDark ? '#1F2937' : '#F8FAFC'),
                  color: active
                    ? (cfg ? cfg.text : '#2563EB')
                    : (isDark ? SLATE_400 : SLATE_500),
                  border: active
                    ? `1px solid ${cfg ? cfg.border : '#2563EB30'}`
                    : `1px solid ${isDark ? '#1F2937' : SLATE_200}`,
                  '&:hover': {
                    backgroundColor: cfg ? cfg.bg : (isDark ? '#1E3A5F' : '#EFF6FF'),
                    color:           cfg ? cfg.text : '#2563EB',
                  },
                }}
              />
            );
          })}
        </Box>
        <Typography sx={{ fontSize: '0.8125rem', color: isDark ? SLATE_500 : SLATE_400, ml: 'auto' }}>
          {loading ? '—' : `${filtered.length} account${filtered.length !== 1 ? 's' : ''}`}
        </Typography>
      </Box>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={44} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            border:       `1px solid ${isDark ? '#1F2937' : SLATE_200}`,
            borderRadius: 2,
            boxShadow:    'none',
            overflow:     'hidden',
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Account #', 'Customer', 'Product Type', 'Balance (₹)', 'Mode', 'Status', 'Approval', 'Actions'].map(h => (
                  <TableCell key={h} align={h === 'Balance (₹)' ? 'right' : h === 'Actions' ? 'center' : 'left'}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ p: 0, border: 0 }}>
                    <EmptyState
                      icon={<AccountBoxIcon sx={{ fontSize: 40 }} />}
                      title={searchQuery || statusFilter !== 'All' ? 'No matching accounts' : 'No accounts yet'}
                      description={
                        searchQuery || statusFilter !== 'All'
                          ? 'Try adjusting your search or filter criteria.'
                          : 'Create your first account by clicking New Account above.'
                      }
                      actionLabel={searchQuery || statusFilter !== 'All' ? undefined : 'New Account'}
                      onAction={searchQuery || statusFilter !== 'All' ? undefined : openCreate}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(acc => (
                  <TableRow key={acc.accountId}>
                    <TableCell sx={{ fontFamily: 'ui-monospace,monospace', fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#93C5FD' : '#2563EB' }}>
                      {acc.accountNumber ?? `ACC-${acc.accountId}`}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.875rem', color: isDark ? '#F1F5F9' : '#334155' }}>
                      {acc.customerId}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.875rem' }}>
                      {acc.productType?.name ?? `Type ${acc.productTypeId ?? '—'}`}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'ui-monospace,monospace', fontSize: '0.875rem', fontWeight: 600 }}>
                      {acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8125rem', color: isDark ? SLATE_400 : SLATE_500 }}>
                      {acc.modeOfOperation ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <StatusChip label={acc.status ?? 'Active'} />
                        {acc.maturityJournalNumber && (
                          <Tooltip title={`View GL Journal: ${acc.maturityJournalNumber}`} arrow>
                            <PaymentsIcon
                              sx={{ fontSize: '0.95rem', color: '#0369A1', cursor: 'pointer', '&:hover': { color: '#059669' } }}
                              onClick={() => setJournalNumber(acc.maturityJournalNumber!)}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <StatusChip label={acc.approvalStatus ?? 'Pending'} />
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(acc)} sx={{ color: isDark ? SLATE_400 : SLATE_500, '&:hover': { color: '#2563EB' } }}>
                          <EditIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Tooltip>
                      {acc.approvalStatus === 'Pending' && (
                        <Tooltip title="Approve">
                          <IconButton size="small" onClick={() => handleApprove(acc)} sx={{ color: '#059669', '&:hover': { color: '#047857', backgroundColor: '#ECFDF5' } }}>
                            <CheckCircleIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {/* FD/RD lifecycle actions */}
                      {(acc.productType?.name === 'FD' || acc.productType?.name === 'RD') && acc.status === 'Active' && (
                        <Tooltip title="Process Maturity">
                          <IconButton aria-label="Process Maturity" size="small" onClick={() => handleMature(acc)} sx={{ color: '#0369A1', '&:hover': { color: '#075985', backgroundColor: '#F0F9FF' } }}>
                            <SavingsIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(acc.productType?.name === 'FD' || acc.productType?.name === 'RD') && acc.status === 'Active' && (
                        <Tooltip title="Premature Closure">
                          <IconButton aria-label="Premature Closure" size="small" onClick={() => handlePrematureClose(acc)} sx={{ color: '#D97706', '&:hover': { color: '#B45309', backgroundColor: '#FFFBEB' } }}>
                            <MoneyOffIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {acc.status === 'Active' && (
                        <Tooltip title="Freeze Account">
                          <IconButton aria-label="Freeze Account" size="small" onClick={() => handleFreeze(acc)} sx={{ color: '#0369A1', '&:hover': { color: '#075985', backgroundColor: '#E0F2FE' } }}>
                            <AcUnitIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {acc.status === 'Frozen' && (
                        <Tooltip title="Unfreeze Account">
                          <IconButton aria-label="Unfreeze Account" size="small" onClick={() => handleUnfreeze(acc)} sx={{ color: '#059669', '&:hover': { color: '#047857', backgroundColor: '#ECFDF5' } }}>
                            <LockOpenIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {acc.status !== 'Closed' && acc.status !== 'Mature' && acc.status !== 'Frozen' && (
                        <Tooltip title="Close Account">
                          <IconButton size="small" onClick={() => handleClose(acc)} sx={{ color: isDark ? SLATE_500 : SLATE_400, '&:hover': { color: '#DC2626', backgroundColor: '#FEF2F2' } }}>
                            <LockIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(acc)} sx={{ color: isDark ? SLATE_500 : SLATE_400, '&:hover': { color: '#DC2626', backgroundColor: '#FEF2F2' } }}>
                          <DeleteIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Account' : 'New Account'}</DialogTitle>
        <DialogContent dividers>
          {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Account Number" fullWidth size="small" value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} placeholder="Leave blank to auto-generate" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Customer ID *" fullWidth size="small" type="number" value={form.customerId || ''} onChange={e => setForm(f => ({ ...f, customerId: +e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Product Type</InputLabel>
                <Select label="Product Type" value={form.productTypeId ?? ''} onChange={e => setForm(f => ({ ...f, productTypeId: +e.target.value || undefined }))}>
                  <MenuItem value=""><em>Select type</em></MenuItem>
                  {PRODUCT_TYPES.map((pt, i) => <MenuItem key={pt} value={i + 1}>{pt}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Opening Balance (₹)" fullWidth size="small" type="number" value={form.balance ?? 0} onChange={e => setForm(f => ({ ...f, balance: +e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Mode of Operation</InputLabel>
                <Select label="Mode of Operation" value={form.modeOfOperation ?? 'SingleOperator'} onChange={e => setForm(f => ({ ...f, modeOfOperation: e.target.value }))}>
                  {MODES.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Branch ID" fullWidth size="small" type="number" value={form.branchId ?? ''} onChange={e => setForm(f => ({ ...f, branchId: +e.target.value || undefined }))} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={form.isMinor ?? false} onChange={e => setForm(f => ({ ...f, isMinor: e.target.checked }))} />}
                label="Minor Account"
              />
            </Grid>
            {form.isMinor && (
              <Grid size={{ xs: 12 }}>
                <TextField label="Legal Guardian Name" fullWidth size="small" value={form.legalGuardianName ?? ''} onChange={e => setForm(f => ({ ...f, legalGuardianName: e.target.value }))} />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* GL Journal Detail Dialog */}
      {journalNumber && (
        <JournalDetailDialog
          journalNumber={journalNumber}
          open={!!journalNumber}
          onClose={() => setJournalNumber(null)}
        />
      )}
    </Box>
  );
};

export default AccountManagement;

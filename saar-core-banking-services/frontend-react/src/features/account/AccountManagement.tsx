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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import { accountService, AccountRecord, CreateAccountDto } from '../../services/accountService';

// ── Status chip colours ────────────────────────────────────────────────────────
const statusColour = (s?: string): 'success' | 'warning' | 'error' | 'default' => {
  const m: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    Active: 'success', Approved: 'success',
    Pending: 'warning',
    Frozen: 'error', Closed: 'error', Rejected: 'error',
  };
  return m[s ?? ''] ?? 'default';
};

const PRODUCT_TYPES = ['Savings', 'Current', 'FD', 'RD', 'NRE', 'NRO', 'FCNR'];
const MODES         = ['SingleOperator', 'JointOperator', 'JointOperatorEither', 'Guardian'];

const BLANK: CreateAccountDto = {
  accountNumber:    '',
  customerId:       0,
  productTypeId:    undefined,
  balance:          0,
  modeOfOperation:  'SingleOperator',
  isMinor:          false,
  legalGuardianName: '',
  branchId:          undefined,
};

const AccountManagement: React.FC = () => {
  const [accounts, setAccounts]       = useState<AccountRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editing, setEditing]         = useState<AccountRecord | null>(null);
  const [form, setForm]               = useState<CreateAccountDto>(BLANK);
  const [saving, setSaving]           = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────────
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

  // ── Dialog ───────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm(BLANK);
    setActionError(null);
    setDialogOpen(true);
  };

  const openEdit = (acc: AccountRecord) => {
    setEditing(acc);
    setForm({
      accountNumber:    acc.accountNumber ?? '',
      customerId:       acc.customerId,
      productTypeId:    acc.productTypeId,
      balance:          acc.balance,
      modeOfOperation:  acc.modeOfOperation ?? 'SingleOperator',
      isMinor:          acc.isMinor ?? false,
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

  // ── Row actions ───────────────────────────────────────────────────────────────
  const handleDelete = async (acc: AccountRecord) => {
    if (!window.confirm(`Delete account ${acc.accountNumber ?? acc.accountId}?`)) return;
    try {
      await accountService.remove(acc.accountId);
      await load();
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? 'Delete failed.');
    }
  };

  const handleApprove = async (acc: AccountRecord) => {
    try {
      await accountService.approve(acc.accountId);
      await load();
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? 'Approve failed.');
    }
  };

  const handleClose = async (acc: AccountRecord) => {
    if (!window.confirm(`Close account ${acc.accountNumber ?? acc.accountId}? This cannot be undone.`)) return;
    try {
      await accountService.close(acc.accountId);
      await load();
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? 'Close failed.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>Account Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New Account
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'grey.50' } }}>
                <TableCell>Account #</TableCell>
                <TableCell>Customer ID</TableCell>
                <TableCell>Product Type</TableCell>
                <TableCell align="right">Balance (₹)</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Approval</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No accounts yet — click <strong>New Account</strong> to create one.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map(acc => (
                  <TableRow key={acc.accountId} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {acc.accountNumber ?? `ACC-${acc.accountId}`}
                    </TableCell>
                    <TableCell>{acc.customerId}</TableCell>
                    <TableCell>{acc.productType?.name ?? `Type ${acc.productTypeId ?? '—'}`}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                      {acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{acc.modeOfOperation ?? '—'}</TableCell>
                    <TableCell>
                      <Chip label={acc.status ?? 'Active'} color={statusColour(acc.status)} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={acc.approvalStatus ?? 'Pending'}
                        color={statusColour(acc.approvalStatus)}
                        size="small" variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(acc)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {acc.approvalStatus === 'Pending' && (
                        <Tooltip title="Approve (Checker action)">
                          <IconButton size="small" color="success" onClick={() => handleApprove(acc)}>
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {acc.status !== 'Closed' && (
                        <Tooltip title="Close Account">
                          <IconButton size="small" color="warning" onClick={() => handleClose(acc)}>
                            <LockIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(acc)}>
                          <DeleteIcon fontSize="small" />
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
            <Grid item xs={12} sm={6}>
              <TextField
                label="Account Number" fullWidth size="small"
                value={form.accountNumber}
                onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                placeholder="Leave blank to auto-generate"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Customer ID *" fullWidth size="small" type="number"
                value={form.customerId || ''}
                onChange={e => setForm(f => ({ ...f, customerId: +e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Product Type</InputLabel>
                <Select
                  label="Product Type"
                  value={form.productTypeId ?? ''}
                  onChange={e => setForm(f => ({ ...f, productTypeId: +e.target.value || undefined }))}
                >
                  <MenuItem value=""><em>Select type</em></MenuItem>
                  {PRODUCT_TYPES.map((pt, i) => (
                    <MenuItem key={pt} value={i + 1}>{pt}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Opening Balance (₹)" fullWidth size="small" type="number"
                value={form.balance ?? 0}
                onChange={e => setForm(f => ({ ...f, balance: +e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Mode of Operation</InputLabel>
                <Select
                  label="Mode of Operation"
                  value={form.modeOfOperation ?? 'SingleOperator'}
                  onChange={e => setForm(f => ({ ...f, modeOfOperation: e.target.value }))}
                >
                  {MODES.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch ID" fullWidth size="small" type="number"
                value={form.branchId ?? ''}
                onChange={e => setForm(f => ({ ...f, branchId: +e.target.value || undefined }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isMinor ?? false}
                    onChange={e => setForm(f => ({ ...f, isMinor: e.target.checked }))}
                  />
                }
                label="Minor Account"
              />
            </Grid>
            {form.isMinor && (
              <Grid item xs={12}>
                <TextField
                  label="Legal Guardian Name" fullWidth size="small"
                  value={form.legalGuardianName ?? ''}
                  onChange={e => setForm(f => ({ ...f, legalGuardianName: e.target.value }))}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccountManagement;

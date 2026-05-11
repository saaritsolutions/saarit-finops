import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, Grid, IconButton, InputLabel,
  MenuItem, Pagination, Paper, Select, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import BlockIcon from '@mui/icons-material/Block';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
  customerService,
  CustomerRecord,
  CustomerListParams,
  CreateCustomerDto,
  KYC_STATUS_LABELS,
} from '../../services/customerService';
import KycDocumentDialog from './KycDocumentDialog';

// ── helpers ───────────────────────────────────────────────────────────────────

const EMPTY_FORM: CreateCustomerDto = {
  salutation: '', firstName: '', middleName: '', lastName: '',
  fatherOrHusbandName: '', mobile: '', email: '', dateOfBirth: '',
  gender: '', pan: '', uid: '', customerType: 'Individual', postalAddress: '',
};

function fullName(c: CustomerRecord) {
  return [c.salutation, c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ') || '—';
}

function kycColor(status: number): 'default' | 'success' | 'warning' | 'error' | 'info' {
  return status === 3 ? 'success' : status === 4 ? 'error' : status === 0 ? 'default' : 'warning';
}

// ── component ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const CustomerManagement: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // filter bar — input values
  const [search, setSearch]         = useState('');
  const [kycFilter, setKycFilter]   = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  // pagination
  const [page, setPage]             = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  // committed filter values (only updated on Search button / dropdown change)
  const [appliedParams, setAppliedParams] = useState<CustomerListParams>({
    search: '', kycStatus: 'ALL', customerType: 'ALL', page: 1, pageSize: PAGE_SIZE,
  });

  // create/edit dialog
  const [open, setOpen]                   = useState(false);
  const [editing, setEditing]             = useState<CustomerRecord | null>(null);
  const [form, setForm]                   = useState<CreateCustomerDto>(EMPTY_FORM);
  const [saving, setSaving]               = useState(false);
  const [formError, setFormError]         = useState<string | null>(null);
  const [panValidating, setPanValidating] = useState(false);
  const [panStatus, setPanStatus]         = useState<string | null>(null);

  // KYC workflow dialog (verify / reject)
  const [kycAction, setKycAction]     = useState<'verify' | 'reject' | null>(null);
  const [kycTargetId, setKycTargetId] = useState<number | null>(null);
  const [kycInput, setKycInput]       = useState('');
  const [kycLoading, setKycLoading]   = useState(false);
  const [kycError, setKycError]       = useState<string | null>(null);

  // KYC document upload dialog
  const [kycDocDialogOpen, setKycDocDialogOpen] = useState(false);
  const [kycDocTargetId, setKycDocTargetId]     = useState<number | null>(null);
  const [kycDocCustomerType, setKycDocCustomerType] = useState('Individual');

  // ── data ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await customerService.list(appliedParams);
      setCustomers(data.items);
      setTotalCount(data.total);
    } catch (e: any) {
      setError(e?.response?.data || e?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [appliedParams]);

  useEffect(() => { load(); }, [load]);

  function handleSearch() {
    setAppliedParams({ search, kycStatus: kycFilter, customerType: typeFilter, page: 1, pageSize: PAGE_SIZE });
    setPage(1);
  }

  function handleReset() {
    setSearch(''); setKycFilter('ALL'); setTypeFilter('ALL'); setPage(1);
    setAppliedParams({ search: '', kycStatus: 'ALL', customerType: 'ALL', page: 1, pageSize: PAGE_SIZE });
  }

  function handleKycDropdown(val: string) {
    setKycFilter(val);
    setPage(1);
    setAppliedParams(p => ({ ...p, kycStatus: val, page: 1 }));
  }

  function handleTypeDropdown(val: string) {
    setTypeFilter(val);
    setPage(1);
    setAppliedParams(p => ({ ...p, customerType: val, page: 1 }));
  }

  function handlePageChange(_: React.ChangeEvent<unknown>, newPage: number) {
    setPage(newPage);
    setAppliedParams(p => ({ ...p, page: newPage }));
  }

  // ── dialog helpers ────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setPanStatus(null);
    setOpen(true);
  }

  function openEdit(c: CustomerRecord) {
    setEditing(c);
    setForm({
      salutation: c.salutation || '', firstName: c.firstName || '',
      middleName: c.middleName || '', lastName: c.lastName || '',
      fatherOrHusbandName: c.fatherOrHusbandName || '',
      mobile: c.mobile || '', email: c.email || '',
      dateOfBirth: c.dateOfBirth ? c.dateOfBirth.substring(0, 10) : '',
      gender: c.gender || '', pan: c.pan || '', uid: c.uid || '',
      customerType: c.customerType || 'Individual',
      postalAddress: c.postalAddress || '',
    });
    setFormError(null);
    setPanStatus(null);
    setOpen(true);
  }

  function field(name: keyof CreateCustomerDto) {
    return {
      value: (form[name] as string) ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [name]: e.target.value })),
    };
  }

  // ── PAN validation ────────────────────────────────────────────────────────

  async function validatePan() {
    if (!form.pan) return;
    setPanValidating(true);
    setPanStatus(null);
    try {
      const r = await customerService.validatePan(form.pan);
      setPanStatus(r.isValid ? '✓ Valid PAN format' : `✗ ${r.message}`);
    } catch {
      setPanStatus('Could not validate — check service');
    } finally {
      setPanValidating(false);
    }
  }

  // ── save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.firstName && !form.lastName) {
      setFormError('First name or last name is required');
      return;
    }
    if (!form.dateOfBirth) {
      setFormError('Date of birth is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await customerService.update(editing.customerId, { ...form, customerId: editing.customerId } as any);
      } else {
        await customerService.create(form);
      }
      setOpen(false);
      await load();
    } catch (e: any) {
      setFormError(e?.response?.data || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ── delete ────────────────────────────────────────────────────────────────

  async function handleDelete(c: CustomerRecord) {
    if (!window.confirm(`Delete customer "${fullName(c)}"?`)) return;
    try {
      await customerService.remove(c.customerId);
      await load();
    } catch (e: any) {
      setError(e?.response?.data || e?.message || 'Delete failed');
    }
  }

  // ── KYC actions ───────────────────────────────────────────────────────────

  async function handleKycSimple(id: number, action: 'initiate' | 'expire') {
    setSuccessMsg(null);
    setError(null);
    try {
      const result = action === 'initiate'
        ? await customerService.initiateKyc(id)
        : await customerService.expireKyc(id);
      setSuccessMsg(result.message);
      await load();
    } catch (e: any) {
      setError(e?.response?.data || e?.message || 'KYC action failed');
    }
  }

  function openKycDocumentDialog(id: number, customerType: string) {
    setKycDocTargetId(id);
    setKycDocCustomerType(customerType);
    setKycDocDialogOpen(true);
  }

  async function handleKycDocumentSuccess(markAsSubmitted: boolean) {
    setSuccessMsg(markAsSubmitted ? 'Documents submitted successfully' : 'Documents saved');
    await load();
  }

  async function handleMarkKycIncomplete(id: number) {
    if (!window.confirm('Mark KYC as incomplete? You will need to re-upload documents.')) return;
    setSuccessMsg(null);
    setError(null);
    try {
      const result = await customerService.markKycIncomplete(id);
      setSuccessMsg(result.message);
      await load();
    } catch (e: any) {
      setError(e?.response?.data || e?.message || 'Failed to mark KYC incomplete');
    }
  }

  function openKycDialog(id: number, action: 'verify' | 'reject') {
    setKycTargetId(id);
    setKycAction(action);
    setKycInput('');
    setKycError(null);
  }

  async function handleKycConfirm() {
    if (!kycTargetId || !kycAction) return;
    if (!kycInput.trim()) {
      setKycError(kycAction === 'verify' ? 'Verified By is required' : 'Rejection Reason is required');
      return;
    }
    setKycLoading(true);
    setKycError(null);
    try {
      const result = kycAction === 'verify'
        ? await customerService.verifyKyc(kycTargetId, kycInput.trim())
        : await customerService.rejectKyc(kycTargetId, kycInput.trim());
      setKycAction(null);
      setKycTargetId(null);
      setSuccessMsg(result.message);
      await load();
    } catch (e: any) {
      setKycError(e?.response?.data || e?.message || 'KYC action failed');
    } finally {
      setKycLoading(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>Customer Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New Customer
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Filter bar */}
      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Search"
            placeholder="Name, mobile, email, PAN..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            sx={{ minWidth: 240 }}
            inputProps={{ 'aria-label': 'search customers' }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>KYC Status</InputLabel>
            <Select
              label="KYC Status"
              value={kycFilter}
              onChange={e => handleKycDropdown(e.target.value as string)}
              inputProps={{ 'aria-label': 'kyc status filter' }}
            >
              <MenuItem value="ALL">All Statuses</MenuItem>
              <MenuItem value="0">Not Started</MenuItem>
              <MenuItem value="1">In Progress</MenuItem>
              <MenuItem value="2">Docs Submitted</MenuItem>
              <MenuItem value="3">Verified</MenuItem>
              <MenuItem value="4">Rejected</MenuItem>
              <MenuItem value="5">Expired</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Type</InputLabel>
            <Select
              label="Type"
              value={typeFilter}
              onChange={e => handleTypeDropdown(e.target.value as string)}
              inputProps={{ 'aria-label': 'customer type filter' }}
            >
              <MenuItem value="ALL">All Types</MenuItem>
              <MenuItem value="Individual">Individual</MenuItem>
              <MenuItem value="Corporate">Corporate</MenuItem>
              <MenuItem value="NRI">NRI</MenuItem>
              <MenuItem value="Government">Government</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={handleSearch}>Search</Button>
          <Button variant="text" onClick={handleReset}>Reset</Button>
        </Box>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'primary.main' }}>
            <TableRow>
              {['Name', 'Type', 'Mobile', 'Email', 'PAN', 'KYC Status', 'Created', 'Actions'].map(h => (
                <TableCell key={h} sx={{ color: 'white', fontWeight: 600 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {appliedParams.search || appliedParams.kycStatus !== 'ALL' || appliedParams.customerType !== 'ALL'
                    ? 'No customers match the current filters.'
                    : 'No customers yet. Click "New Customer" to add the first one.'}
                </TableCell>
              </TableRow>
            ) : customers.map(c => (
              <TableRow key={c.customerId} hover>
                <TableCell sx={{ fontWeight: 500 }}>{fullName(c)}</TableCell>
                <TableCell>{c.customerType || '—'}</TableCell>
                <TableCell>{c.mobile || '—'}</TableCell>
                <TableCell>{c.email || '—'}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{c.pan || '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={KYC_STATUS_LABELS[c.kycStatus] ?? 'Unknown'}
                    color={kycColor(c.kycStatus)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '—'}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {/* KYC workflow buttons — shown based on current state */}
                  {c.kycStatus === 0 && (
                    <Tooltip title="Initiate KYC">
                      <IconButton size="small" color="primary" aria-label="Initiate KYC"
                        onClick={() => handleKycSimple(c.customerId, 'initiate')}>
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {c.kycStatus === 1 && (
                    <Tooltip title="Upload Documents">
                      <IconButton size="small" color="info" aria-label="Upload Documents"
                        onClick={() => openKycDocumentDialog(c.customerId, c.customerType || 'Individual')}>
                        <UploadFileIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {c.kycStatus === 2 && (
                    <>
                      <Tooltip title="Verify KYC">
                        <IconButton size="small" color="success" aria-label="Verify KYC"
                          onClick={() => openKycDialog(c.customerId, 'verify')}>
                          <VerifiedUserIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reject KYC">
                        <IconButton size="small" color="error" aria-label="Reject KYC"
                          onClick={() => openKycDialog(c.customerId, 'reject')}>
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Back to In Progress">
                        <IconButton size="small" color="warning" aria-label="Back to In Progress"
                          onClick={() => handleMarkKycIncomplete(c.customerId)}>
                          <RestartAltIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  {c.kycStatus === 3 && (
                    <Tooltip title="Expire KYC">
                      <IconButton size="small" color="warning" aria-label="Expire KYC"
                        onClick={() => handleKycSimple(c.customerId, 'expire')}>
                        <HourglassEmptyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {/* Standard CRUD buttons */}
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(c)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDelete(c)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalCount > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} customers
          </Typography>
          <Pagination
            count={Math.ceil(totalCount / PAGE_SIZE)}
            page={page}
            onChange={handlePageChange}
            color="primary"
            size="small"
          />
        </Box>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? 'Edit Customer' : 'New Customer'}</DialogTitle>
        <DialogContent dividers>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

          <Grid container spacing={2} sx={{ mt: 0 }}>
            {/* Row 1 — name */}
            <Grid size={{ xs: 12, sm: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Salutation</InputLabel>
                <Select label="Salutation" value={form.salutation || ''}
                  onChange={e => setForm(f => ({ ...f, salutation: e.target.value as string }))}>
                  {['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'].map(s => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth size="small" label="First Name *" {...field('firstName')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth size="small" label="Middle Name" {...field('middleName')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth size="small" label="Last Name *" {...field('lastName')} />
            </Grid>

            {/* Row 2 — contact */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Mobile" inputProps={{ maxLength: 15 }} {...field('mobile')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Email" type="email" {...field('email')} />
            </Grid>

            {/* Row 3 — DOB + gender */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Date of Birth *" type="date"
                InputLabelProps={{ shrink: true }} {...field('dateOfBirth')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Gender</InputLabel>
                <Select label="Gender" value={form.gender || ''}
                  onChange={e => setForm(f => ({ ...f, gender: e.target.value as string }))}>
                  {['Male', 'Female', 'Other', 'Prefer not to say'].map(g => (
                    <MenuItem key={g} value={g}>{g}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Row 4 — PAN + Aadhaar */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  fullWidth size="small" label="PAN"
                  inputProps={{ maxLength: 10, style: { textTransform: 'uppercase' } }}
                  value={form.pan || ''}
                  onChange={e => { setForm(f => ({ ...f, pan: e.target.value.toUpperCase() })); setPanStatus(null); }}
                  helperText={panStatus ?? 'Format: ABCDE1234F'}
                  FormHelperTextProps={{
                    sx: { color: panStatus?.startsWith('✓') ? 'success.main' : panStatus ? 'error.main' : 'text.secondary' }
                  }}
                />
                <Tooltip title="Validate PAN format">
                  <span>
                    <IconButton size="small" onClick={validatePan} disabled={!form.pan || panValidating} sx={{ mt: 0.5 }}>
                      {panValidating ? <CircularProgress size={18} /> : <CheckCircleIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Aadhaar (UID)"
                inputProps={{ maxLength: 12 }} {...field('uid')}
                helperText="12-digit Aadhaar number" />
            </Grid>

            {/* Row 5 — customer type + father/husband name */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Customer Type</InputLabel>
                <Select label="Customer Type" value={form.customerType || 'Individual'}
                  onChange={e => setForm(f => ({ ...f, customerType: e.target.value as string }))}>
                  {['Individual', 'Corporate', 'Government', 'NRI'].map(t => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Father / Husband Name" {...field('fatherOrHusbandName')} />
            </Grid>

            {/* Row 6 — address */}
            <Grid size={12}>
              <TextField fullWidth size="small" label="Postal Address" multiline rows={2} {...field('postalAddress')} />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}>
            {editing ? 'Update Customer' : 'Create Customer'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* KYC Verify / Reject dialog */}
      <Dialog open={kycAction !== null} onClose={() => !kycLoading && setKycAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {kycAction === 'verify' ? 'Verify KYC' : 'Reject KYC'}
        </DialogTitle>
        <DialogContent dividers>
          {kycError && <Alert severity="error" sx={{ mb: 2 }}>{kycError}</Alert>}
          <TextField
            fullWidth
            size="small"
            label={kycAction === 'verify' ? 'Verified By *' : 'Rejection Reason *'}
            value={kycInput}
            onChange={e => setKycInput(e.target.value)}
            placeholder={kycAction === 'verify' ? 'Officer name or employee ID' : 'Reason for rejection'}
            multiline={kycAction === 'reject'}
            rows={kycAction === 'reject' ? 3 : 1}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setKycAction(null)} disabled={kycLoading}>Cancel</Button>
          <Button
            variant="contained"
            color={kycAction === 'verify' ? 'success' : 'error'}
            onClick={handleKycConfirm}
            disabled={kycLoading}
            startIcon={kycLoading ? <CircularProgress size={16} /> : undefined}
          >
            {kycAction === 'verify' ? 'Confirm Verify' : 'Confirm Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* KYC Document Upload dialog */}
      <KycDocumentDialog
        open={kycDocDialogOpen}
        customerId={kycDocTargetId || 0}
        customerType={kycDocCustomerType}
        onClose={() => setKycDocDialogOpen(false)}
        onSuccess={handleKycDocumentSuccess}
      />
    </Box>
  );
};

export default CustomerManagement;

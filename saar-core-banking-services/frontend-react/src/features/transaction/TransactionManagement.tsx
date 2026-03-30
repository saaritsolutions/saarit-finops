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
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import {
  transactionService,
  Journal,
  LedgerBalance,
  PostJournalRequest,
  PostEntryRequest,
} from '../../services/transactionService';

// ── Helpers ───────────────────────────────────────────────────────────────────

const INR = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const BLANK_ENTRY: PostEntryRequest = {
  accountCode: '', debitAmount: 0, creditAmount: 0, currency: 'INR', narration: '',
};

// ── Component ─────────────────────────────────────────────────────────────────

const TransactionManagement: React.FC = () => {
  const [tab, setTab]                 = useState(0);
  const [balances, setBalances]       = useState<LedgerBalance[]>([]);
  const [journals, setJournals]       = useState<Journal[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<number | null>(null);

  // Post journal dialog state
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [description, setDescription] = useState('');
  const [entries, setEntries]         = useState<PostEntryRequest[]>([
    { ...BLANK_ENTRY }, { ...BLANK_ENTRY },
  ]);
  const [saving, setSaving]           = useState(false);
  const [dlgError, setDlgError]       = useState<string | null>(null);

  // ── Load both datasets ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bals, jrnls] = await Promise.all([
        transactionService.getLedgerBalances(),
        transactionService.listJournals(),
      ]);
      setBalances(bals);
      setJournals(jrnls);
    } catch {
      setError('Failed to load data — check that TransactionService is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Post dialog ───────────────────────────────────────────────────────────────
  const openDialog = () => {
    setDescription('');
    setEntries([{ ...BLANK_ENTRY }, { ...BLANK_ENTRY }]);
    setDlgError(null);
    setDialogOpen(true);
  };

  const setEntry = (i: number, patch: Partial<PostEntryRequest>) =>
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e));

  const addEntry = () => setEntries(prev => [...prev, { ...BLANK_ENTRY }]);

  const removeEntry = (i: number) =>
    setEntries(prev => prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev);

  const totalDebit  = entries.reduce((s, e) => s + (e.debitAmount  || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.creditAmount || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01;

  const handlePost = async () => {
    if (!description.trim())    { setDlgError('Description is required.');          return; }
    if (!balanced)              { setDlgError(`Journal is unbalanced — Debit ₹${INR(totalDebit)} ≠ Credit ₹${INR(totalCredit)}.`); return; }
    if (totalDebit <= 0)        { setDlgError('At least one debit entry is required.'); return; }

    const req: PostJournalRequest = {
      idempotencyKey: `manual-${Date.now()}`,
      description,
      referenceType: 'Manual',
      postedBy:      'demo-user',
      entries:       entries.filter(e => e.accountCode.trim()),
    };

    setSaving(true);
    setDlgError(null);
    try {
      await transactionService.postJournal(req);
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      setDlgError(e?.response?.data?.error ?? e?.message ?? 'Post failed.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>Transaction Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openDialog}>
          Post Journal Entry
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Ledger Balances" />
        <Tab label="Journal Entries" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : tab === 0 ? (
        /* ── Ledger Balances tab ─────────────────────────────────────────────── */
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'grey.50' } }}>
                <TableCell>Account Code</TableCell>
                <TableCell>Account Name</TableCell>
                <TableCell>Normal Balance</TableCell>
                <TableCell align="right">Debit Total (₹)</TableCell>
                <TableCell align="right">Credit Total (₹)</TableCell>
                <TableCell align="right">Balance (₹)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {balances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No ledger accounts yet — post a journal entry to initialise balances.
                  </TableCell>
                </TableRow>
              ) : (
                balances.map(b => (
                  <TableRow key={b.accountCode} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{b.accountCode}</TableCell>
                    <TableCell>{b.accountName}</TableCell>
                    <TableCell>
                      <Chip
                        label={b.normalBalance ?? 'Debit'}
                        size="small"
                        color={b.normalBalance === 'Credit' ? 'secondary' : 'primary'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{INR(b.debitTotal)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{INR(b.creditTotal)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontFamily: 'monospace', fontWeight: 700,
                        color: b.balance < 0 ? 'error.main' : 'text.primary',
                      }}
                    >
                      {INR(b.balance)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        /* ── Journal Entries tab ─────────────────────────────────────────────── */
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'grey.50' } }}>
                <TableCell sx={{ width: 32 }} />
                <TableCell>Journal #</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Posted By</TableCell>
                <TableCell>Posted At</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {journals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No journal entries yet — click <strong>Post Journal Entry</strong>.
                  </TableCell>
                </TableRow>
              ) : (
                journals.map(j => (
                  <React.Fragment key={j.journalId}>
                    <TableRow hover>
                      <TableCell>
                        <Tooltip title={expandedId === j.journalId ? 'Collapse' : 'Expand entries'}>
                          <IconButton
                            size="small"
                            onClick={() => setExpandedId(expandedId === j.journalId ? null : j.journalId)}
                          >
                            {expandedId === j.journalId ? (
                              <ExpandLessIcon fontSize="small" />
                            ) : (
                              <ExpandMoreIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{j.journalNumber}</TableCell>
                      <TableCell>{j.description}</TableCell>
                      <TableCell>{j.postedBy}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{fmtDate(j.postedAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label={j.status}
                          size="small"
                          color={j.status === 'Posted' ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                    {/* Expanded entry lines */}
                    {expandedId === j.journalId && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ bgcolor: 'grey.50', py: 0 }}>
                          <Box sx={{ px: 4, py: 1 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 600, fontSize: '0.75rem' } }}>
                                  <TableCell>Account Code</TableCell>
                                  <TableCell>Account Name</TableCell>
                                  <TableCell align="right">Debit (₹)</TableCell>
                                  <TableCell align="right">Credit (₹)</TableCell>
                                  <TableCell>Narration</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {j.entries.map(e => (
                                  <TableRow key={e.journalEntryId}>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                      {e.accountCode}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.75rem' }}>{e.accountName}</TableCell>
                                    <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                      {e.debitAmount > 0 ? INR(e.debitAmount) : '—'}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                      {e.creditAmount > 0 ? INR(e.creditAmount) : '—'}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.75rem' }}>{e.narration ?? ''}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Post Journal Entry Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Post Journal Entry</DialogTitle>
        <DialogContent dividers>
          {dlgError && <Alert severity="error" sx={{ mb: 2 }}>{dlgError}</Alert>}

          <TextField
            label="Description *" fullWidth size="small" sx={{ mb: 3 }}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Loan disbursement to customer 42"
          />

          {/* Entry lines */}
          {entries.map((entry, i) => (
            <Grid container spacing={1} key={i} sx={{ mb: 1, alignItems: 'center' }}>
              <Grid item xs={3}>
                <TextField
                  label="Account Code" size="small" fullWidth
                  value={entry.accountCode}
                  onChange={e => setEntry(i, { accountCode: e.target.value })}
                  placeholder="e.g. 1010"
                />
              </Grid>
              <Grid item xs={2.5}>
                <TextField
                  label="Debit (₹)" size="small" fullWidth type="number"
                  value={entry.debitAmount || ''}
                  onChange={e => setEntry(i, { debitAmount: +e.target.value })}
                />
              </Grid>
              <Grid item xs={2.5}>
                <TextField
                  label="Credit (₹)" size="small" fullWidth type="number"
                  value={entry.creditAmount || ''}
                  onChange={e => setEntry(i, { creditAmount: +e.target.value })}
                />
              </Grid>
              <Grid item xs={3}>
                <TextField
                  label="Narration" size="small" fullWidth
                  value={entry.narration ?? ''}
                  onChange={e => setEntry(i, { narration: e.target.value })}
                />
              </Grid>
              <Grid item xs={1}>
                <Tooltip title="Remove line">
                  <span>
                    <IconButton
                      size="small" color="error"
                      disabled={entries.length <= 2}
                      onClick={() => removeEntry(i)}
                    >
                      ×
                    </IconButton>
                  </span>
                </Tooltip>
              </Grid>
            </Grid>
          ))}

          <Button size="small" onClick={addEntry} sx={{ mt: 1 }}>+ Add Line</Button>

          {/* Totals row */}
          <Box sx={{
            display: 'flex', gap: 4, mt: 2, p: 1.5,
            bgcolor: balanced ? 'success.50' : 'error.50',
            borderRadius: 1, border: '1px solid',
            borderColor: balanced ? 'success.200' : 'error.200',
          }}>
            <Typography variant="body2">
              <strong>Total Debit:</strong> ₹{INR(totalDebit)}
            </Typography>
            <Typography variant="body2">
              <strong>Total Credit:</strong> ₹{INR(totalCredit)}
            </Typography>
            <Typography variant="body2" color={balanced ? 'success.main' : 'error.main'}>
              <strong>{balanced ? '✓ Balanced' : '✗ Unbalanced'}</strong>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handlePost} disabled={saving || !balanced}>
            {saving ? <CircularProgress size={20} /> : 'Post'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TransactionManagement;

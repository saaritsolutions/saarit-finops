import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Chip,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import { transactionService, type Journal } from '../../services/transactionService';

const SLATE_50  = '#F8FAFC';
const SLATE_200 = '#E2E8F0';
const SLATE_500 = '#64748B';

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

interface JournalDetailDialogProps {
  journalNumber: string;
  open: boolean;
  onClose: () => void;
}

const JournalDetailDialog: React.FC<JournalDetailDialogProps> = ({ journalNumber, open, onClose }) => {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open || !journalNumber) return;
    setLoading(true); setError(null); setJournal(null);
    transactionService.getJournalByNumber(journalNumber)
      .then(j => setJournal(j))
      .catch(() => setError('Could not load journal from TransactionService. Is the service running?'))
      .finally(() => setLoading(false));
  }, [open, journalNumber]);

  const totalDebit  = journal?.entries.reduce((s, e) => s + e.debitAmount,  0) ?? 0;
  const totalCredit = journal?.entries.reduce((s, e) => s + e.creditAmount, 0) ?? 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PaymentsIcon sx={{ color: '#059669' }} />
        GL Journal — {journalNumber}
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="warning">{error}</Alert>}
        {journal && !loading && (
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Description</Typography>
                <Typography variant="body2" fontWeight={500}>{journal.description || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Posted By</Typography>
                <Typography variant="body2" fontWeight={500}>{journal.postedBy}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Posted At</Typography>
                <Typography variant="body2" fontWeight={500}>{fmtDate(journal.postedAt)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Reference</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {journal.referenceType}{journal.referenceId ? ` / ${journal.referenceId}` : ''}
                </Typography>
              </Box>
              <Chip
                label={journal.status}
                size="small"
                color={journal.status === 'Posted' ? 'success' : 'default'}
                sx={{ alignSelf: 'flex-end' }}
              />
            </Box>

            <TableContainer sx={{ border: `1px solid ${SLATE_200}`, borderRadius: 1 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: SLATE_50 }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Account Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Account Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Narration</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Debit (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Credit (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {journal.entries.map(e => (
                    <TableRow key={e.journalEntryId}>
                      <TableCell sx={{ fontFamily: 'ui-monospace,monospace', fontSize: '0.8rem' }}>
                        {e.accountCode}
                      </TableCell>
                      <TableCell>{e.accountName}</TableCell>
                      <TableCell sx={{ color: SLATE_500, fontSize: '0.8rem' }}>{e.narration || '—'}</TableCell>
                      <TableCell align="right" sx={{ color: e.debitAmount > 0 ? '#DC2626' : 'inherit' }}>
                        {e.debitAmount > 0 ? e.debitAmount.toLocaleString('en-IN') : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: e.creditAmount > 0 ? '#059669' : 'inherit' }}>
                        {e.creditAmount > 0 ? e.creditAmount.toLocaleString('en-IN') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: SLATE_50 }}>
                    <TableCell colSpan={3} sx={{ fontWeight: 700 }}>Totals</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#DC2626' }}>
                      {totalDebit.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#059669' }}>
                      {totalCredit.toLocaleString('en-IN')}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderColor: SLATE_200 }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default JournalDetailDialog;

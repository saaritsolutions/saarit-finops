import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, Snackbar, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import WarningAmberIcon   from '@mui/icons-material/WarningAmber';
import AddCircleIcon      from '@mui/icons-material/AddCircle';
import PageHeader         from '../components/common/PageHeader';
import {
  getTodayGoldRate, getGoldRateHistory, createGoldRate,
  type GoldRateEntry,
} from '../services/goldLoanService';

// ── Design tokens ──────────────────────────────────────────────────────────────
const AMBER_50  = '#FFFBEB';
const AMBER_600 = '#D97706';
const BLUE_600  = '#2563EB';
const SLATE_50  = '#F8FAFC';
const SLATE_200 = '#E2E8F0';
const SLATE_500 = '#64748B';
const SLATE_900 = '#0F172A';
const GOLD_BG   = '#FEF9C3';
const GOLD_500  = '#EAB308';

const INR = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });

export default function GoldRateAdmin() {
  const [todayRate,  setTodayRate]  = useState<GoldRateEntry | null>(null);
  const [history,    setHistory]    = useState<GoldRateEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [snack,      setSnack]      = useState<string | null>(null);

  // Form state
  const today = new Date().toISOString().split('T')[0];
  const [formDate,  setFormDate]  = useState(today);
  const [formRate,  setFormRate]  = useState('');
  const [formSrc,   setFormSrc]   = useState('MANUAL');
  const [formError, setFormError] = useState<string | null>(null);

  const reload = async () => {
    try {
      setLoading(true);
      const [rate, hist] = await Promise.allSettled([
        getTodayGoldRate(),
        getGoldRateHistory(30),
      ]);
      if (rate.status === 'fulfilled') setTodayRate(rate.value);
      else setTodayRate(null);
      if (hist.status === 'fulfilled') setHistory(hist.value);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const rateNum = parseFloat(formRate);
    if (!formDate) { setFormError('Date is required.'); return; }
    if (isNaN(rateNum) || rateNum <= 0) { setFormError('Rate must be a positive number.'); return; }

    setSaving(true);
    try {
      await createGoldRate({
        rateDate:          new Date(formDate).toISOString(),
        ratePerGramFor22K: rateNum,
        source:            formSrc,
      });
      setSnack(`Gold rate ₹${rateNum}/g saved for ${formDate}.`);
      setFormRate('');
      setFormDate(today);
      await reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to save rate.';
      if (err?.response?.status === 409)
        setFormError(`A rate for ${formDate} already exists. Edit is not supported — please contact admin.`);
      else
        setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 960, mx: 'auto' }}>
      <PageHeader
        title="Gold Rate Administration"
        subtitle="Enter the daily IBJA 22K gold rate. Used for pledge valuation and LTV calculation."
        icon={<MonetizationOnIcon sx={{ color: GOLD_500, fontSize: 28 }} />}
      />

      {/* ── Today's Rate Card ── */}
      <Card sx={{ mb: 3, background: GOLD_BG, border: `1px solid ${GOLD_500}33` }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="overline" color="text.secondary">Today's Gold Rate (22K)</Typography>
              {loading ? (
                <CircularProgress size={24} sx={{ display: 'block', mt: 1 }} />
              ) : todayRate ? (
                <>
                  <Typography variant="h3" fontWeight={700} color={GOLD_500}>
                    {INR(todayRate.ratePerGramFor22K)}<Typography component="span" variant="h6" color={SLATE_500}> / gram</Typography>
                  </Typography>
                  <Stack direction="row" spacing={1} mt={1} alignItems="center">
                    <Chip label={fmtDate(todayRate.rateDate)} size="small" />
                    <Chip label={todayRate.source} size="small" variant="outlined" />
                    <Chip label={`By: ${todayRate.enteredBy}`} size="small" variant="outlined" />
                    {todayRate.isLatest === false && (
                      <Chip
                        icon={<WarningAmberIcon />}
                        label={`Showing rate from ${fmtDate(todayRate.rateDate)} (today's rate not yet entered)`}
                        color="warning"
                        size="small"
                      />
                    )}
                  </Stack>
                </>
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  No gold rate has been entered yet. Enter today's rate below.
                </Alert>
              )}
            </Box>
            <MonetizationOnIcon sx={{ fontSize: 64, color: `${GOLD_500}55` }} />
          </Stack>
        </CardContent>
      </Card>

      {/* ── Enter Rate Form ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Enter Daily Rate
          </Typography>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <TextField
                label="Date"
                type="date"
                size="small"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 160 }}
              />
              <TextField
                label="Rate per gram (₹)"
                type="number"
                size="small"
                value={formRate}
                onChange={e => setFormRate(e.target.value)}
                placeholder="e.g. 7500"
                inputProps={{ min: 1, step: '0.01' }}
                sx={{ minWidth: 200 }}
              />
              <TextField
                label="Source"
                select
                size="small"
                value={formSrc}
                onChange={e => setFormSrc(e.target.value)}
                SelectProps={{ native: true }}
                sx={{ minWidth: 130 }}
              >
                <option value="MANUAL">MANUAL</option>
                <option value="IBJA">IBJA</option>
                <option value="MCX">MCX</option>
              </TextField>
              <Button
                type="submit"
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddCircleIcon />}
                disabled={saving}
                sx={{ bgcolor: BLUE_600, '&:hover': { bgcolor: '#1D4ED8' }, height: 40 }}
              >
                {saving ? 'Saving…' : 'Save Rate'}
              </Button>
            </Stack>
            {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
          </Box>
        </CardContent>
      </Card>

      {/* ── History Table ── */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Rate History — Last 30 Days
          </Typography>
          {loading ? (
            <CircularProgress />
          ) : history.length === 0 ? (
            <Typography color="text.secondary">No rate entries found.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: SLATE_50 }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Rate/gram (22K)</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Entered By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell>{fmtDate(r.rateDate)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: GOLD_500 }}>
                        {INR(r.ratePerGramFor22K)}
                      </TableCell>
                      <TableCell>
                        <Chip label={r.source} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ color: SLATE_500 }}>{r.enteredBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        message={snack}
      />
    </Box>
  );
}

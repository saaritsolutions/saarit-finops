import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, CircularProgress,
  InputAdornment, Stack, Tab, Tabs, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import DiamondIcon   from '@mui/icons-material/Diamond';
import SearchIcon    from '@mui/icons-material/Search';
import AddIcon       from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import {
  getGoldLoanApplications,
  type GoldLoanListItem,
} from '../services/goldLoanService';

// ── Design tokens ──────────────────────────────────────────────────────────────
const BLUE_600  = '#2563EB';
const SLATE_50  = '#F8FAFC';
const SLATE_500 = '#64748B';
const GOLD_500  = '#EAB308';

const INR = (n?: number | null) =>
  n != null ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';

const WGT = (n?: number | null) =>
  n != null ? `${n.toFixed(3)} g` : '—';

const LTV = (n?: number | null) =>
  n != null ? `${n.toFixed(2)}%` : '—';

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

// ── Status config ──────────────────────────────────────────────────────────────
type StatusColor = 'default' | 'warning' | 'info' | 'success' | 'error' | 'primary' | 'secondary';
const STATUS_CFG: Record<string, { label: string; color: StatusColor }> = {
  DRAFT:      { label: 'Draft',      color: 'default'   },
  SUBMITTED:  { label: 'Submitted',  color: 'info'      },
  APPRAISED:  { label: 'Appraised',  color: 'secondary' },
  SANCTIONED: { label: 'Sanctioned', color: 'warning'   },
  DISBURSED:  { label: 'Disbursed',  color: 'success'   },
  CLOSED:     { label: 'Closed',     color: 'default'   },
};

const TABS = [
  { label: 'All',         status: undefined },
  { label: 'Pending',     status: 'SUBMITTED' },
  { label: 'Sanctioned',  status: 'SANCTIONED' },
  { label: 'Disbursed',   status: 'DISBURSED' },
  { label: 'Closed',      status: 'CLOSED' },
];

export default function GoldLoanList() {
  const navigate = useNavigate();
  const [tabIdx,    setTabIdx]    = useState(0);
  const [search,    setSearch]    = useState('');
  const [items,     setItems]     = useState<GoldLoanListItem[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page]                    = useState(1);
  const [loading,   setLoading]   = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getGoldLoanApplications({
        status:   TABS[tabIdx].status,
        search:   search || undefined,
        page,
        pageSize: 50,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tabIdx, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Gold Loans"
        subtitle="Manage gold loan origination, pledge register, and bullet repayment."
        icon={<DiamondIcon sx={{ color: GOLD_500, fontSize: 28 }} />}
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/gold-loans/new')}
            sx={{ bgcolor: BLUE_600, '&:hover': { bgcolor: '#1D4ED8' } }}
          >
            New Gold Loan
          </Button>
        }
      />

      {/* ── Filter bar ── */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              size="small"
              placeholder="Search by name, app#, mobile, PAN…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              sx={{ minWidth: 280 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              {total} application{total !== 1 ? 's' : ''}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <Tabs
        value={tabIdx}
        onChange={(_, v) => setTabIdx(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {TABS.map((t, i) => (
          <Tab key={i} label={t.label} />
        ))}
      </Tabs>

      {/* ── Table ── */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: SLATE_50 }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>App #</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Applicant</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Net Wt (g)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Valued Amt</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>LTV %</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Sanction Amt</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: SLATE_500 }}>
                    No gold loan applications found.
                  </TableCell>
                </TableRow>
              ) : (
                items.map(item => {
                  const cfg = STATUS_CFG[item.goldLoanStatus] ?? { label: item.goldLoanStatus, color: 'default' as StatusColor };
                  return (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/gold-loans/${item.id}`)}
                    >
                      <TableCell sx={{ fontWeight: 600, color: BLUE_600 }}>
                        {item.applicationNumber}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{item.applicantName}</Typography>
                        {item.panNumber && (
                          <Typography variant="caption" color="text.secondary">{item.panNumber}</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{WGT(item.totalNetWeightGrams)}</TableCell>
                      <TableCell align="right">{INR(item.totalValuedAmount)}</TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={
                            item.ltvPercent > 75 ? 'error.main' :
                            item.ltvPercent > 70 ? 'warning.main' : 'success.main'
                          }
                        >
                          {LTV(item.ltvPercent)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{INR(item.sanctionedAmount)}</TableCell>
                      <TableCell>
                        <Chip label={cfg.label} color={cfg.color} size="small" />
                      </TableCell>
                      <TableCell sx={{ color: SLATE_500, fontSize: 12 }}>
                        {fmtDate(item.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

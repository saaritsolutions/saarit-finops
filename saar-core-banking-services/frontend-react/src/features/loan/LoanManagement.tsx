import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoanApplication {
  id: string;
  customerId: string;
  productType: string;
  amount: number;
  tenureMonths: number;
  status: string;  // DRAFT | SUBMITTED | IN_REVIEW | APPROVED | REJECTED | DISBURSED
  interestRate?: number;
  createdAt: string;
}

// ── Status chip colour ────────────────────────────────────────────────────────

const statusColour = (s: string): 'default' | 'warning' | 'info' | 'success' | 'error' => {
  switch (s) {
    case 'DRAFT':      return 'default';
    case 'SUBMITTED':  return 'warning';
    case 'IN_REVIEW':  return 'info';
    case 'APPROVED':   return 'success';
    case 'DISBURSED':  return 'success';
    case 'REJECTED':   return 'error';
    default:           return 'default';
  }
};

const LOAN_BASE = '/api/LoanOrigination';
const INR = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 0 });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });

// ── Component ─────────────────────────────────────────────────────────────────

const LoanManagement: React.FC = () => {
  const navigate = useNavigate();
  const [apps, setApps]       = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setApps(await apiService.get<LoanApplication[]>(LOAN_BASE));
    } catch {
      setError('Failed to load loan applications — check that LoanService is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>Loan Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/loans/new')}
        >
          New Loan Application
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
                <TableCell>Application ID</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Product</TableCell>
                <TableCell align="right">Amount (₹)</TableCell>
                <TableCell>Tenure</TableCell>
                <TableCell>Rate (%)</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Applied On</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No loan applications yet — click <strong>New Loan Application</strong> to start.
                  </TableCell>
                </TableRow>
              ) : (
                apps.map(app => (
                  <TableRow key={app.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      {app.id.slice(0, 8)}…
                    </TableCell>
                    <TableCell>{app.customerId}</TableCell>
                    <TableCell>
                      <Chip label={app.productType} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                      {INR(app.amount)}
                    </TableCell>
                    <TableCell>{app.tenureMonths} mo</TableCell>
                    <TableCell>
                      {app.interestRate != null ? `${app.interestRate.toFixed(2)}%` : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip label={app.status} size="small" color={statusColour(app.status)} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{fmtDate(app.createdAt)}</TableCell>
                    <TableCell align="center">
                      <Button
                        size="small" variant="text"
                        onClick={() => navigate(`/loans/${app.id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default LoanManagement;

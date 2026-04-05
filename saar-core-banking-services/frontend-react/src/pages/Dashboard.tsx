import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Divider,
  useTheme,
} from '@mui/material';
import {
  People as PeopleIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  MonetizationOn as MoneyIcon,
  PersonAdd as PersonAddIcon,
  AccountBalanceWallet as NewAccountIcon,
  CreditScore as NewLoanIcon,
  BarChart as ReportsIcon,
  ArrowForward as ArrowRightIcon,
  Circle as DotIcon,
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/common/StatCard';
import PageHeader from '../components/common/PageHeader';

// ─── Design Tokens ─────────────────────────────────────────────────────────
const BLUE_50   = '#EFF6FF';
const BLUE_600  = '#2563EB';
const BLUE_700  = '#1D4ED8';
const SLATE_100 = '#F1F5F9';
const SLATE_200 = '#E2E8F0';
const SLATE_300 = '#CBD5E1';
const SLATE_400 = '#94A3B8';
const SLATE_500 = '#64748B';
const SLATE_600 = '#475569';
const SLATE_700 = '#334155';
const SLATE_900 = '#0F172A';

// ─── Mock Data ─────────────────────────────────────────────────────────────

const transactionVolumeData = [
  { day: 'Mon', amount: 4200 },
  { day: 'Tue', amount: 5800 },
  { day: 'Wed', amount: 5100 },
  { day: 'Thu', amount: 7200 },
  { day: 'Fri', amount: 8400 },
  { day: 'Sat', amount: 3900 },
  { day: 'Sun', amount: 3200 },
];

const accountsByProduct = [
  { name: 'Savings',  count: 4820 },
  { name: 'Current',  count: 2340 },
  { name: 'FD',       count: 1890 },
  { name: 'RD',       count: 980  },
  { name: 'Loans',    count: 847  },
];

const BAR_COLORS = [BLUE_600, '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

const recentActivity = [
  { id: 1, text: 'New account opened for Arjun Mehta',         time: '2 min ago',  dot: '#10B981' },
  { id: 2, text: 'Loan application submitted by Priya Sharma', time: '8 min ago',  dot: BLUE_600  },
  { id: 3, text: 'KYC verified for Rohit Kumar',               time: '15 min ago', dot: '#F59E0B' },
  { id: 4, text: 'Transaction of ₹2,50,000 processed',         time: '22 min ago', dot: '#8B5CF6' },
  { id: 5, text: 'Fixed Deposit renewed — Sunita Patel',       time: '41 min ago', dot: '#10B981' },
  { id: 6, text: 'Loan disbursed to Vijay Nair — ₹5,00,000',  time: '1 hr ago',   dot: BLUE_600  },
];

// ─── Custom Tooltips ────────────────────────────────────────────────────────

const AreaTooltip = ({ active, payload, label, isDark }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ backgroundColor: isDark ? '#1F2937' : '#FFF', border: `1px solid ${isDark ? '#374151' : SLATE_200}`, borderRadius: 2, p: 1.5, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: isDark ? SLATE_300 : SLATE_700, mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: BLUE_600 }}>
        ₹{(payload[0].value / 100).toFixed(1)}L
      </Typography>
    </Box>
  );
};

const BarTooltip = ({ active, payload, label, isDark }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ backgroundColor: isDark ? '#1F2937' : '#FFF', border: `1px solid ${isDark ? '#374151' : SLATE_200}`, borderRadius: 2, p: 1.5, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: isDark ? SLATE_300 : SLATE_700, mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: payload[0].fill }}>
        {payload[0].value.toLocaleString()} accounts
      </Typography>
    </Box>
  );
};

// ─── Quick Action Card ──────────────────────────────────────────────────────

interface QuickActionProps {
  icon:    React.ReactNode;
  label:   string;
  color:   string;
  bg:      string;
  onClick: () => void;
  isDark:  boolean;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, color, bg, onClick, isDark }) => (
  <Box
    onClick={onClick}
    sx={{
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      gap:             1,
      p:               2,
      borderRadius:    10,
      border:          `1px solid ${isDark ? '#1F2937' : SLATE_200}`,
      backgroundColor: isDark ? '#111827' : '#FFFFFF',
      cursor:          'pointer',
      transition:      'all 150ms ease',
      '&:hover': {
        borderColor:     color,
        backgroundColor: isDark ? '#1F2937' : bg,
        transform:       'translateY(-2px)',
        boxShadow:       '0 4px 12px rgba(0,0,0,0.08)',
      },
    }}
  >
    <Box sx={{ width: 40, height: 40, borderRadius: 2.5, backgroundColor: isDark ? `${color}20` : bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, '& svg': { fontSize: '1.25rem' } }}>
      {icon}
    </Box>
    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: isDark ? SLATE_300 : SLATE_700, textAlign: 'center', lineHeight: 1.3 }}>
      {label}
    </Typography>
  </Box>
);

// ─── Dashboard ──────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const theme    = useTheme();
  const navigate = useNavigate();
  const isDark   = theme.palette.mode === 'dark';

  const gridColor  = isDark ? '#1F2937' : SLATE_200;
  const axisColor  = isDark ? SLATE_600 : SLATE_400;
  const gradId     = 'txnVolumeGrad';

  const hour    = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today   = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Box>
      <PageHeader title="Dashboard" subtitle={`${greeting} — ${today}`} />

      {/* KPI Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(4,1fr)' }, gap: 2.5, mb: 3 }}>
        <StatCard title="Total Customers"   value="12,847" subtitle="Active customer accounts"  icon={<PeopleIcon />}        trend="up"   trendLabel="+12% this month"     iconColor="#2563EB" iconBg="#EFF6FF" />
        <StatCard title="Total Deposits"    value="₹2.4B"  subtitle="Current deposits balance"  icon={<AccountBalanceIcon />} trend="up"   trendLabel="+8.2% this month"    iconColor="#10B981" iconBg="#ECFDF5" />
        <StatCard title="Daily Transactions" value="8,432" subtitle="Processed today"            icon={<ReceiptIcon />}        trend="up"   trendLabel="+15.3% vs yesterday" iconColor="#F59E0B" iconBg="#FFFBEB" />
        <StatCard title="Active Loans"      value="₹847M"  subtitle="Outstanding loan amount"   icon={<MoneyIcon />}          trend="down" trendLabel="-2.1% this month"    iconColor="#8B5CF6" iconBg="#F5F3FF" />
      </Box>

      {/* Charts */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 2.5, mb: 3 }}>

        {/* Transaction Volume */}
        <Card>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
              <Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: isDark ? SLATE_100 : SLATE_900 }}>Transaction Volume</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: SLATE_500 }}>Last 7 days</Typography>
              </Box>
              <Chip size="small" label="₹38.8L total" sx={{ backgroundColor: isDark ? `${BLUE_700}30` : BLUE_50, color: isDark ? '#93C5FD' : BLUE_700, fontWeight: 600, fontSize: '0.75rem' }} />
            </Box>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={transactionVolumeData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={BLUE_600} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={BLUE_600} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 4" stroke={gridColor} vertical={false} />
                <XAxis dataKey="day"    axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 12, fontFamily: 'Inter,sans-serif' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 11, fontFamily: 'Inter,sans-serif' }} tickFormatter={(v: number) => `${(v/100).toFixed(0)}L`} />
                <RechartsTooltip content={<AreaTooltip isDark={isDark} />} cursor={{ stroke: gridColor, strokeWidth: 1 }} />
                <Area type="monotone" dataKey="amount" stroke={BLUE_600} strokeWidth={2} fill={`url(#${gradId})`} dot={{ r: 3, fill: BLUE_600, strokeWidth: 0 }} activeDot={{ r: 5, fill: BLUE_600, strokeWidth: 2, stroke: '#FFFFFF' }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Accounts by Product Type */}
        <Card>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: isDark ? SLATE_100 : SLATE_900 }}>Accounts by Type</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: SLATE_500 }}>Distribution across products</Typography>
            </Box>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={accountsByProduct} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barSize={26}>
                <CartesianGrid strokeDasharray="3 4" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name"  axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 11, fontFamily: 'Inter,sans-serif' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 11, fontFamily: 'Inter,sans-serif' }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)} />
                <RechartsTooltip content={<BarTooltip isDark={isDark} />} cursor={{ fill: isDark ? '#FFFFFF08' : '#00000005' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {accountsByProduct.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Box>

      {/* Activity + Quick Actions */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' }, gap: 2.5 }}>

        {/* Recent Activity */}
        <Card>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: isDark ? SLATE_100 : SLATE_900 }}>Recent Activity</Typography>
              <Button size="small" endIcon={<ArrowRightIcon sx={{ fontSize: '0.875rem !important' }} />} sx={{ fontSize: '0.8125rem', fontWeight: 600, color: BLUE_600, px: 1, py: 0.375, minWidth: 0 }}>
                View all
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {recentActivity.map((item, i) => (
                <Box key={item.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.25 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, pt: 0.375 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.dot }} />
                    {i < recentActivity.length - 1 && (
                      <Box sx={{ width: 1, height: 20, mt: 0.5, backgroundColor: isDark ? '#1F2937' : SLATE_200 }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, color: isDark ? SLATE_300 : SLATE_700, lineHeight: 1.4 }}>{item.text}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: isDark ? SLATE_500 : SLATE_400, mt: 0.25 }}>{item.time}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: isDark ? SLATE_100 : SLATE_900, mb: 2 }}>Quick Actions</Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2.5 }}>
              <QuickAction icon={<PersonAddIcon />}  label="New Customer" color="#2563EB" bg="#EFF6FF" isDark={isDark} onClick={() => navigate('/customers/create')} />
              <QuickAction icon={<NewAccountIcon />} label="New Account"  color="#10B981" bg="#ECFDF5" isDark={isDark} onClick={() => navigate('/accounts/create')} />
              <QuickAction icon={<NewLoanIcon />}    label="New Loan"     color="#8B5CF6" bg="#F5F3FF" isDark={isDark} onClick={() => navigate('/loans/create')} />
              <QuickAction icon={<ReportsIcon />}    label="View Reports" color="#F59E0B" bg="#FFFBEB" isDark={isDark} onClick={() => navigate('/reports/financial')} />
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {[
                { label: 'Pending Approvals', value: '7',  color: '#F59E0B' },
                { label: 'KYC Pending',        value: '14', color: '#EF4444' },
                { label: 'Loans Due Today',    value: '3',  color: '#8B5CF6' },
              ].map(item => (
                <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DotIcon sx={{ fontSize: 8, color: item.color }} />
                    <Typography sx={{ fontSize: '0.8125rem', color: isDark ? SLATE_400 : SLATE_600 }}>{item.label}</Typography>
                  </Box>
                  <Chip size="small" label={item.value} sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700, backgroundColor: `${item.color}15`, color: item.color, minWidth: 28 }} />
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Dashboard;

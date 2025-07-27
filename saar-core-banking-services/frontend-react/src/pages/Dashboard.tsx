import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Chip,
  useTheme,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  People as PeopleIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  CreditCard as CreditCardIcon,
  Person as PersonIcon,
  MonetizationOn as MoneyIcon,
} from '@mui/icons-material';

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  trendValue?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color = 'primary',
}) => {
  const theme = useTheme();

  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: `${color}.main`,
              mr: 2,
              width: 48,
              height: 48,
            }}
          >
            {icon}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography color="textSecondary" gutterBottom variant="overline">
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 600 }}>
              {value}
            </Typography>
          </Box>
          {trend && trendValue && (
            <Box sx={{ textAlign: 'right' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {trend === 'up' ? (
                  <TrendingUpIcon sx={{ color: 'success.main', mr: 0.5 }} />
                ) : (
                  <TrendingDownIcon sx={{ color: 'error.main', mr: 0.5 }} />
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: trend === 'up' ? 'success.main' : 'error.main',
                    fontWeight: 600,
                  }}
                >
                  {trendValue}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
        <Typography variant="body2" color="textSecondary">
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
};

/**
 * Main dashboard page with key banking metrics and recent activities
 */
const Dashboard: React.FC = () => {
  const theme = useTheme();

  // Mock data for dashboard
  const stats = [
    {
      title: 'Total Customers',
      value: '12,847',
      subtitle: 'Active customer accounts',
      icon: <PeopleIcon />,
      trend: 'up' as const,
      trendValue: '+12%',
      color: 'primary' as const,
    },
    {
      title: 'Total Deposits',
      value: '₹2.4B',
      subtitle: 'Current deposits balance',
      icon: <AccountBalanceIcon />,
      trend: 'up' as const,
      trendValue: '+8.2%',
      color: 'success' as const,
    },
    {
      title: 'Daily Transactions',
      value: '8,432',
      subtitle: 'Transactions processed today',
      icon: <ReceiptIcon />,
      trend: 'up' as const,
      trendValue: '+15.3%',
      color: 'info' as const,
    },
    {
      title: 'Active Loans',
      value: '₹847M',
      subtitle: 'Outstanding loan amount',
      icon: <MoneyIcon />,
      trend: 'down' as const,
      trendValue: '-2.1%',
      color: 'warning' as const,
    },
  ];

  const recentTransactions = [
    {
      id: 'TXN001',
      customer: 'John Doe',
      type: 'Credit',
      amount: '₹25,000',
      account: 'SAV001234',
      time: '10:30 AM',
      status: 'Completed',
    },
    {
      id: 'TXN002',
      customer: 'Jane Smith',
      type: 'Debit',
      amount: '₹8,500',
      account: 'CHK005678',
      time: '10:15 AM',
      status: 'Completed',
    },
    {
      id: 'TXN003',
      customer: 'Mike Johnson',
      type: 'Transfer',
      amount: '₹12,750',
      account: 'SAV009012',
      time: '09:45 AM',
      status: 'Pending',
    },
    {
      id: 'TXN004',
      customer: 'Sarah Wilson',
      type: 'Credit',
      amount: '₹50,000',
      account: 'SAV003456',
      time: '09:30 AM',
      status: 'Completed',
    },
  ];

  const pendingApprovals = [
    {
      id: 'LA001',
      type: 'Loan Application',
      customer: 'Robert Brown',
      amount: '₹500,000',
      product: 'Home Loan',
      priority: 'High',
    },
    {
      id: 'ACC002',
      type: 'Account Opening',
      customer: 'Emily Davis',
      amount: '₹10,000',
      product: 'Savings Account',
      priority: 'Medium',
    },
    {
      id: 'CC003',
      type: 'Credit Card',
      customer: 'David Lee',
      amount: '₹200,000',
      product: 'Gold Credit Card',
      priority: 'Low',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Welcome to SaaR Core Banking System - Overview of your banking operations
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' },
          gap: 3,
          mb: 4,
        }}
      >
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </Box>

      {/* Recent Activities */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 3,
        }}
      >
        {/* Recent Transactions */}
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Recent Transactions
            </Typography>
            <List>
              {recentTransactions.map((transaction, index) => (
                <ListItem
                  key={transaction.id}
                  sx={{
                    borderBottom: index < recentTransactions.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                    px: 0,
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle2">
                          {transaction.customer}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {transaction.amount}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                        <Typography variant="body2" color="textSecondary">
                          {transaction.type} • {transaction.account} • {transaction.time}
                        </Typography>
                        <Chip
                          label={transaction.status}
                          size="small"
                          color={getStatusColor(transaction.status) as any}
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Pending Approvals
            </Typography>
            <List>
              {pendingApprovals.map((approval, index) => (
                <ListItem
                  key={approval.id}
                  sx={{
                    borderBottom: index < pendingApprovals.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                    px: 0,
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="subtitle2">
                          {approval.type}
                        </Typography>
                        <Chip
                          label={approval.priority}
                          size="small"
                          color={getPriorityColor(approval.priority) as any}
                          variant="filled"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          {approval.customer}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                          {approval.amount} • {approval.product}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Dashboard;

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { ProtectedRoute, PublicRoute, BANKING_PERMISSIONS } from './ProtectedRoute';
import Layout from '../components/layout/Layout';

// Lazy load components for better performance
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Login = lazy(() => import('../features/auth/Login'));
const CustomerManagement = lazy(() => import('../features/customer/CustomerManagement'));
const AccountManagement = lazy(() => import('../features/account/AccountManagement'));
const TransactionManagement = lazy(() => import('../features/transaction/TransactionManagement'));
const LoanManagement = lazy(() => import('../features/loan/LoanManagement'));
const Reports = lazy(() => import('../features/reports/Reports'));
const UserManagement = lazy(() => import('../features/admin/UserManagement'));
const Settings = lazy(() => import('../features/settings/Settings'));
const ExpressionBuilder = lazy(() => import('../pages/ExpressionBuilder'));
const TestExpressions = lazy(() => import('../pages/TestExpressions'));
const SimpleExpressionBuilder = lazy(() => import('../pages/SimpleExpressionBuilder'));
const WorldClassExpressionBuilder = lazy(() => import('../pages/WorldClassExpressionBuilder'));
const EndToEndDemo = lazy(() => import('../pages/EndToEndDemo'));
const Unauthorized = lazy(() => import('../components/common/Unauthorized'));
const NotFound = lazy(() => import('../components/common/NotFound'));

// Loading component
const LoadingSpinner: React.FC = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="200px"
  >
    <CircularProgress />
  </Box>
);

// Micro-frontend wrapper for future use
interface MicroFrontendRouteProps {
  path: string;
  microfrontendName: string;
  permission?: string;
  children?: React.ReactNode;
}

const MicroFrontendRoute: React.FC<MicroFrontendRouteProps> = ({
  microfrontendName,
  permission,
  children,
}) => {
  // This will be expanded later for actual micro-frontend loading
  // For now, it just handles permission-based routing
  const content = children || <div>Micro-frontend: {microfrontendName}</div>;
  
  if (permission) {
    return (
      <ProtectedRoute requiredPermission={permission}>
        {content}
      </ProtectedRoute>
    );
  }
  
  return <>{content}</>;
};

/**
 * Main application router
 * Handles all routing for the banking application with proper authentication and authorization
 */
export const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        
        {/* Protected routes with layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Dashboard - accessible to all authenticated users */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          
          {/* Customer Management */}
          <Route
            path="customers/*"
            element={
              <MicroFrontendRoute
                path="/customers"
                microfrontendName="customer-management"
                permission={BANKING_PERMISSIONS.CUSTOMER_VIEW}
              >
                <CustomerManagement />
              </MicroFrontendRoute>
            }
          />
          
          {/* Account Management */}
          <Route
            path="accounts/*"
            element={
              <MicroFrontendRoute
                path="/accounts"
                microfrontendName="account-management"
                permission={BANKING_PERMISSIONS.ACCOUNT_VIEW}
              >
                <AccountManagement />
              </MicroFrontendRoute>
            }
          />
          
          {/* Transaction Management */}
          <Route
            path="transactions/*"
            element={
              <MicroFrontendRoute
                path="/transactions"
                microfrontendName="transaction-management"
                permission={BANKING_PERMISSIONS.TRANSACTION_VIEW}
              >
                <TransactionManagement />
              </MicroFrontendRoute>
            }
          />
          
          {/* Loan Management */}
          <Route
            path="loans/*"
            element={
              <MicroFrontendRoute
                path="/loans"
                microfrontendName="loan-management"
                permission={BANKING_PERMISSIONS.LOAN_VIEW}
              >
                <LoanManagement />
              </MicroFrontendRoute>
            }
          />
          
          {/* Reports */}
          <Route
            path="reports/*"
            element={
              <MicroFrontendRoute
                path="/reports"
                microfrontendName="reports"
                permission={BANKING_PERMISSIONS.REPORTS_VIEW}
              >
                <Reports />
              </MicroFrontendRoute>
            }
          />
          
          {/* Expression Builder */}
          <Route
            path="expressions"
            element={
              <ProtectedRoute requiredPermission={BANKING_PERMISSIONS.EXPRESSION_BUILDER}>
                <WorldClassExpressionBuilder />
              </ProtectedRoute>
            }
          />
          
          {/* End-to-End Demo */}
          <Route
            path="demo"
            element={
              <ProtectedRoute requiredPermission={BANKING_PERMISSIONS.EXPRESSION_BUILDER}>
                <EndToEndDemo />
              </ProtectedRoute>
            }
          />
          
          {/* Simple Expression Builder (legacy) */}
          <Route
            path="expressions/simple"
            element={
              <ProtectedRoute requiredPermission={BANKING_PERMISSIONS.EXPRESSION_BUILDER}>
                <SimpleExpressionBuilder />
              </ProtectedRoute>
            }
          />
          
          {/* Admin Routes */}
          <Route
            path="admin/*"
            element={
              <ProtectedRoute requiredPermission={BANKING_PERMISSIONS.USER_MANAGEMENT}>
                <Routes>
                  <Route path="users" element={<UserManagement />} />
                  <Route path="settings" element={<Settings />} />
                </Routes>
              </ProtectedRoute>
            }
          />
          
          {/* Settings */}
          <Route path="settings" element={<Settings />} />
        </Route>
        
        {/* Error routes */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

// Banking-specific route configuration for micro-frontends
export const MICRO_FRONTEND_ROUTES = {
  CUSTOMER_MANAGEMENT: {
    path: '/customers',
    name: 'customer-management',
    permission: BANKING_PERMISSIONS.CUSTOMER_VIEW,
    remoteEntry: process.env.REACT_APP_CUSTOMER_MF_URL,
  },
  ACCOUNT_MANAGEMENT: {
    path: '/accounts',
    name: 'account-management',
    permission: BANKING_PERMISSIONS.ACCOUNT_VIEW,
    remoteEntry: process.env.REACT_APP_ACCOUNT_MF_URL,
  },
  TRANSACTION_MANAGEMENT: {
    path: '/transactions',
    name: 'transaction-management',
    permission: BANKING_PERMISSIONS.TRANSACTION_VIEW,
    remoteEntry: process.env.REACT_APP_TRANSACTION_MF_URL,
  },
  LOAN_MANAGEMENT: {
    path: '/loans',
    name: 'loan-management',
    permission: BANKING_PERMISSIONS.LOAN_VIEW,
    remoteEntry: process.env.REACT_APP_LOAN_MF_URL,
  },
  REPORTS: {
    path: '/reports',
    name: 'reports',
    permission: BANKING_PERMISSIONS.REPORTS_VIEW,
    remoteEntry: process.env.REACT_APP_REPORTS_MF_URL,
  },
  EXPRESSION_BUILDER: {
    path: '/expressions',
    name: 'expression-builder',
    permission: BANKING_PERMISSIONS.EXPRESSION_BUILDER,
    remoteEntry: process.env.REACT_APP_EXPRESSIONS_MF_URL,
  },
} as const;

export default AppRouter;

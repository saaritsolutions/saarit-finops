import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectUserPermissions, hasPermission } from '../store/slices/authSlice';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  fallbackPath?: string;
}

/**
 * ProtectedRoute component for handling authentication and authorization
 * Used throughout the banking application to secure routes
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  fallbackPath = '/login',
}) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const userPermissions = useSelector(selectUserPermissions);
  const location = useLocation();

  // Check authentication
  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Check authorization if permission is required
  if (requiredPermission && !hasPermission(userPermissions, requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * PublicRoute component for routes that should only be accessible when not authenticated
 * (e.g., login, registration)
 */
export const PublicRoute: React.FC<PublicRouteProps> = ({
  children,
  redirectTo = '/dashboard',
}) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

// Banking-specific route permissions
export const BANKING_PERMISSIONS = {
  // Customer management
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_EDIT: 'customer.edit',
  CUSTOMER_DELETE: 'customer.delete',
  
  // Account management
  ACCOUNT_VIEW: 'account.view',
  ACCOUNT_CREATE: 'account.create',
  ACCOUNT_EDIT: 'account.edit',
  ACCOUNT_CLOSE: 'account.close',
  
  // Transaction management
  TRANSACTION_VIEW: 'transaction.view',
  TRANSACTION_CREATE: 'transaction.create',
  TRANSACTION_APPROVE: 'transaction.approve',
  TRANSACTION_REVERSE: 'transaction.reverse',
  
  // Loan management
  LOAN_VIEW: 'loan.view',
  LOAN_CREATE: 'loan.create',
  LOAN_APPROVE: 'loan.approve',
  LOAN_DISBURSE: 'loan.disburse',
  
  // Reports and analytics
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  ANALYTICS_VIEW: 'analytics.view',
  
  // Admin functions
  USER_MANAGEMENT: 'user.management',
  SYSTEM_CONFIG: 'system.config',
  AUDIT_VIEW: 'audit.view',
  
  // Teller operations
  TELLER_OPERATIONS: 'teller.operations',
  CASH_MANAGEMENT: 'cash.management',
  
  // Approval workflows
  APPROVE_LARGE_TRANSACTIONS: 'approve.large_transactions',
  APPROVE_LOANS: 'approve.loans',
  APPROVE_ACCOUNT_CHANGES: 'approve.account_changes',
} as const;

export default ProtectedRoute;

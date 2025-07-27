// Common types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Customer related types
export interface Customer extends BaseEntity {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  address: Address;
  kyc: KYCInfo;
  status: CustomerStatus;
  customerType: CustomerType;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface KYCInfo {
  documentType: string;
  documentNumber: string;
  documentExpiry: Date;
  verificationStatus: VerificationStatus;
  verifiedAt?: Date;
}

export enum CustomerStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  SUSPENDED = 'Suspended',
  CLOSED = 'Closed'
}

export enum CustomerType {
  INDIVIDUAL = 'Individual',
  CORPORATE = 'Corporate',
  GOVERNMENT = 'Government'
}

export enum VerificationStatus {
  PENDING = 'Pending',
  VERIFIED = 'Verified',
  REJECTED = 'Rejected'
}

// Account related types
export interface Account extends BaseEntity {
  accountNumber: string;
  accountType: AccountType;
  customerId: string;
  customer?: Customer;
  balance: number;
  currency: string;
  status: AccountStatus;
  interestRate?: number;
  overdraftLimit?: number;
  minimumBalance: number;
  accountName: string;
  productId: string;
}

export enum AccountType {
  SAVINGS = 'Savings',
  CURRENT = 'Current',
  FIXED_DEPOSIT = 'FixedDeposit',
  LOAN = 'Loan',
  CREDIT_CARD = 'CreditCard'
}

export enum AccountStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  FROZEN = 'Frozen',
  CLOSED = 'Closed'
}

// Transaction related types
export interface Transaction extends BaseEntity {
  id: string;
  transactionId: string;
  accountId: string;
  account?: Account;
  amount: number;
  currency: string;
  transactionType: TransactionType;
  description: string;
  referenceNumber: string;
  status: TransactionStatus;
  processedAt?: Date;
  reversedAt?: Date;
  reversalReason?: string;
  balanceAfter: number;
  counterPartyAccount?: string;
  counterPartyName?: string;
  fees?: number;
  exchangeRate?: number;
}

export enum TransactionType {
  DEBIT = 'Debit',
  CREDIT = 'Credit',
  TRANSFER = 'Transfer',
  WITHDRAWAL = 'Withdrawal',
  DEPOSIT = 'Deposit',
  FEE = 'Fee',
  INTEREST = 'Interest'
}

export enum TransactionStatus {
  PENDING = 'Pending',
  COMPLETED = 'Completed',
  FAILED = 'Failed',
  CANCELLED = 'Cancelled',
  REVERSED = 'Reversed'
}

// Loan related types
export interface Loan extends BaseEntity {
  loanId: string;
  customerId: string;
  customer?: Customer;
  loanType: LoanType;
  principalAmount: number;
  outstandingAmount: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  startDate: Date;
  maturityDate: Date;
  status: LoanStatus;
  collateral?: Collateral[];
  guarantors?: Guarantor[];
}

export interface Collateral {
  id: string;
  type: string;
  description: string;
  value: number;
  currency: string;
}

export interface Guarantor {
  id: string;
  name: string;
  relationship: string;
  contactInfo: string;
}

export enum LoanType {
  PERSONAL = 'Personal',
  HOME = 'Home',
  AUTO = 'Auto',
  BUSINESS = 'Business',
  EDUCATION = 'Education'
}

export enum LoanStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  ACTIVE = 'Active',
  PAID_OFF = 'PaidOff',
  DEFAULTED = 'Defaulted',
  REJECTED = 'Rejected'
}

// User and Authentication types
export interface User extends BaseEntity {
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  permissions: Permission[];
  status: UserStatus;
  lastLoginAt?: Date;
  department?: string;
  branch?: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

export enum UserStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  LOCKED = 'Locked'
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors?: string[];
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Form and UI types
export interface FormValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface TableColumn {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  format?: (value: any) => string;
  sortable?: boolean;
}

// Notification types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: Date;
  userId: string;
}

export enum NotificationType {
  INFO = 'Info',
  SUCCESS = 'Success',
  WARNING = 'Warning',
  ERROR = 'Error'
}

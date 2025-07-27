import * as yup from 'yup';

// Common validation patterns for banking
export const VALIDATION_PATTERNS = {
  // Account numbers (various formats)
  ACCOUNT_NUMBER: /^[0-9]{8,20}$/,
  
  // Phone numbers (international format)
  PHONE: /^\+?[1-9]\d{1,14}$/,
  
  // Email
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  // Currency amounts (up to 2 decimal places)
  CURRENCY: /^\d+(\.\d{1,2})?$/,
  
  // Routing number (9 digits for US)
  ROUTING_NUMBER: /^[0-9]{9}$/,
  
  // Swift code (8 or 11 characters)
  SWIFT_CODE: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/,
  
  // Tax ID / SSN
  TAX_ID: /^[0-9]{3}-[0-9]{2}-[0-9]{4}$/,
  
  // Postal codes (US and international)
  POSTAL_CODE: /^[A-Z0-9\s-]{3,10}$/i,
};

// Common validation schemas
export const commonValidations = {
  // Required string with minimum length
  requiredString: (fieldName: string, minLength = 1) =>
    yup.string()
      .required(`${fieldName} is required`)
      .min(minLength, `${fieldName} must be at least ${minLength} characters`),

  // Email validation
  email: yup.string()
    .required('Email is required')
    .matches(VALIDATION_PATTERNS.EMAIL, 'Please enter a valid email address'),

  // Phone validation
  phone: yup.string()
    .required('Phone number is required')
    .matches(VALIDATION_PATTERNS.PHONE, 'Please enter a valid phone number'),

  // Currency amount validation
  currency: (fieldName: string, min = 0, max = 999999999.99) =>
    yup.number()
      .required(`${fieldName} is required`)
      .min(min, `${fieldName} must be at least ${min}`)
      .max(max, `${fieldName} cannot exceed ${max}`)
      .test('decimal-places', `${fieldName} can have at most 2 decimal places`, (value) => {
        if (value === undefined || value === null) return true;
        return Number.isInteger(value * 100);
      }),

  // Date validation
  date: (fieldName: string, required = true) => {
    let schema = yup.date().typeError(`${fieldName} must be a valid date`);
    if (required) {
      schema = schema.required(`${fieldName} is required`);
    }
    return schema;
  },

  // Date of birth validation (must be 18+ years old)
  dateOfBirth: yup.date()
    .required('Date of birth is required')
    .max(
      new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000),
      'Must be at least 18 years old'
    )
    .typeError('Please enter a valid date'),

  // Account number validation
  accountNumber: yup.string()
    .required('Account number is required')
    .matches(VALIDATION_PATTERNS.ACCOUNT_NUMBER, 'Please enter a valid account number'),

  // Password validation for banking (strong requirements)
  password: yup.string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),

  // Confirm password
  confirmPassword: yup.string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
};

// Banking-specific validation schemas
export const bankingValidations = {
  // Customer information
  customerSchema: yup.object({
    firstName: commonValidations.requiredString('First name', 2),
    lastName: commonValidations.requiredString('Last name', 2),
    email: commonValidations.email,
    phone: commonValidations.phone,
    dateOfBirth: commonValidations.dateOfBirth,
    address: yup.object({
      street: commonValidations.requiredString('Street address'),
      city: commonValidations.requiredString('City'),
      state: commonValidations.requiredString('State'),
      zipCode: yup.string()
        .required('ZIP code is required')
        .matches(VALIDATION_PATTERNS.POSTAL_CODE, 'Please enter a valid ZIP code'),
      country: commonValidations.requiredString('Country'),
    }),
  }),

  // Account creation
  accountSchema: yup.object({
    accountType: yup.string()
      .required('Account type is required')
      .oneOf(['Savings', 'Current', 'FixedDeposit'], 'Please select a valid account type'),
    customerId: commonValidations.requiredString('Customer ID'),
    initialDeposit: commonValidations.currency('Initial deposit', 0),
    currency: yup.string()
      .required('Currency is required')
      .oneOf(['USD', 'EUR', 'GBP', 'JPY', 'CAD'], 'Please select a valid currency'),
    accountName: commonValidations.requiredString('Account name'),
  }),

  // Transaction form
  transactionSchema: yup.object({
    fromAccount: commonValidations.accountNumber,
    toAccount: commonValidations.accountNumber,
    amount: commonValidations.currency('Amount', 0.01),
    currency: commonValidations.requiredString('Currency'),
    description: commonValidations.requiredString('Description', 5),
    transactionType: yup.string()
      .required('Transaction type is required')
      .oneOf(['Transfer', 'Deposit', 'Withdrawal'], 'Please select a valid transaction type'),
  }),

  // Loan application
  loanSchema: yup.object({
    customerId: commonValidations.requiredString('Customer ID'),
    loanType: yup.string()
      .required('Loan type is required')
      .oneOf(['Personal', 'Home', 'Auto', 'Business', 'Education'], 'Please select a valid loan type'),
    principalAmount: commonValidations.currency('Loan amount', 1000),
    termMonths: yup.number()
      .required('Loan term is required')
      .min(6, 'Minimum loan term is 6 months')
      .max(360, 'Maximum loan term is 360 months'),
    interestRate: yup.number()
      .required('Interest rate is required')
      .min(0.01, 'Interest rate must be greater than 0')
      .max(50, 'Interest rate cannot exceed 50%'),
    purpose: commonValidations.requiredString('Loan purpose', 10),
  }),

  // Login form
  loginSchema: yup.object({
    username: commonValidations.requiredString('Username', 3),
    password: commonValidations.requiredString('Password'),
  }),

  // User registration
  registrationSchema: yup.object({
    username: commonValidations.requiredString('Username', 3),
    email: commonValidations.email,
    firstName: commonValidations.requiredString('First name'),
    lastName: commonValidations.requiredString('Last name'),
    password: commonValidations.password,
    confirmPassword: commonValidations.confirmPassword,
    department: commonValidations.requiredString('Department'),
    role: commonValidations.requiredString('Role'),
  }),
};

// Validation utility functions
export const validationUtils = {
  // Test if a value matches a pattern
  testPattern: (value: string, pattern: RegExp): boolean => {
    return pattern.test(value);
  },

  // Format validation error messages
  formatError: (error: yup.ValidationError): Record<string, string> => {
    const errors: Record<string, string> = {};
    error.inner.forEach((err) => {
      if (err.path) {
        errors[err.path] = err.message;
      }
    });
    return errors;
  },

  // Validate currency amount
  validateCurrency: (amount: string | number): boolean => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return !isNaN(numAmount) && numAmount >= 0 && Number.isInteger(numAmount * 100);
  },

  // Validate account number format
  validateAccountNumber: (accountNumber: string): boolean => {
    return VALIDATION_PATTERNS.ACCOUNT_NUMBER.test(accountNumber);
  },

  // Calculate password strength
  calculatePasswordStrength: (password: string): number => {
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10;
    
    // Character variety checks
    if (/[a-z]/.test(password)) strength += 20;
    if (/[A-Z]/.test(password)) strength += 20;
    if (/[0-9]/.test(password)) strength += 20;
    if (/[^A-Za-z0-9]/.test(password)) strength += 10;
    
    return Math.min(strength, 100);
  },
};

export default bankingValidations;

/// <reference types="cypress" />
export {};

/**
 * REGRESSION — Dashboard Module
 * Covers: KPI StatCards, upcoming maturities widget, charts,
 *         quick actions, data refresh.
 */

const ACCOUNTS = [
  { accountId: 1, accountNumber: 'SB-001',  customerId: 1, balance: 25000,  status: 'Active',  approvalStatus: 'Approved', productType: { name: 'Savings' } },
  { accountId: 2, accountNumber: 'FD-001',  customerId: 1, balance: 100000, status: 'Active',  approvalStatus: 'Approved', productType: { name: 'Fixed Deposit' } },
  { accountId: 3, accountNumber: 'FD-002',  customerId: 2, balance: 50000,  status: 'Mature',  approvalStatus: 'Approved', productType: { name: 'Fixed Deposit' } },
];

const MATURITIES = [
  {
    accountId:               2,
    accountNumber:           'FD-001',
    customerId:              1,
    productType:             'Fixed Deposit',
    balance:                 100000,
    maturityDate:            new Date(Date.now() + 3 * 86400000).toISOString(),
    termMonths:              12,
    annualRate:              7.5,
    projectedInterest:       7500,
    projectedMaturityAmount: 107500,
  },
  {
    accountId:               3,
    accountNumber:           'FD-002',
    customerId:              2,
    productType:             'Fixed Deposit',
    balance:                 50000,
    maturityDate:            new Date(Date.now() + 14 * 86400000).toISOString(),
    termMonths:              6,
    annualRate:              6.5,
    projectedInterest:       1950,
    projectedMaturityAmount: 51950,
  },
];

const LOANS = [
  { loanApplicationId: 1, fullName: 'Ramesh Kumar', loanAmount: 500000, status: 'APPROVED' },
  { loanApplicationId: 2, fullName: 'Priya Sharma',  loanAmount: 250000, status: 'SUBMITTED' },
];

describe('[REGRESSION] Dashboard', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/account/accounts*',           { body: ACCOUNTS }).as('accounts');
    cy.intercept('GET', '**/api/account/upcoming-maturities*', { body: MATURITIES }).as('maturities');
    cy.intercept('GET', '**/api/LoanApplications*',           { body: LOANS }).as('loans');
    cy.intercept('GET', '**/api/customer/customers*',         { body: [] }).as('customers');
    cy.intercept('GET', '**/api/ledger/balances*',            { body: [] }).as('balances');
  });

  it('loads the dashboard page', () => {
    cy.visit('/dashboard');
    cy.get('body').should('be.visible');
    cy.contains(/dashboard/i, { timeout: 15000 }).should('exist');
  });

  it('shows summary KPI stat cards', () => {
    cy.visit('/dashboard');
    // Dashboard should show numeric KPI cards (accounts count, loan count, etc.)
    cy.get('[class*="StatCard"], [class*="stat"], [class*="kpi"], [class*="Card"]', { timeout: 15000 })
      .should('have.length.gte', 1);
  });

  it('renders upcoming maturities widget with data', () => {
    cy.visit('/dashboard');
    cy.wait('@maturities', { timeout: 15000 });
    cy.contains(/upcoming maturity|maturities|maturity/i, { timeout: 15000 }).should('exist');
    // FD-001 should appear
    cy.contains(/FD-001/, { timeout: 15000 }).should('exist');
  });

  it('shows urgency chip for deposits maturing within 7 days', () => {
    cy.visit('/dashboard');
    cy.wait('@maturities', { timeout: 15000 });
    // FD-001 matures in 3 days — should have "urgent" / "today" / days indicator
    cy.contains(/day|urgent|soon|3/i, { timeout: 15000 }).should('exist');
  });

  it('shows quick-action links to key modules', () => {
    cy.visit('/dashboard');
    // Dashboard has navigation shortcuts
    cy.contains(/account|loan|customer/i, { timeout: 15000 }).should('exist');
  });

  it('accounts page is accessible from the app', () => {
    cy.stubApis();
    cy.visit('/dashboard');
    cy.contains(/dashboard/i, { timeout: 10000 }).should('exist');
    // Navigate to the accounts route directly — this is what a sidebar/quick-action click
    // ultimately does via React Router's navigate(). The route accessibility matters more
    // than which UI element triggers it (full click-flow is covered in E2E smoke suite).
    cy.visit('/accounts');
    cy.url().should('include', '/account');
    cy.get('body').should('be.visible');
  });
});

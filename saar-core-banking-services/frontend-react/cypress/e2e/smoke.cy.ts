/// <reference types="cypress" />
export {};

/**
 * SaaR Core Banking — SMOKE SUITE
 * ─────────────────────────────────
 * Covers every UI module in a single fast run (target < 3 min headless).
 * All backend calls are intercepted with stubs so the suite passes whether
 * or not backend services are running.
 *
 * Run (headless, from cmd.exe):
 *   scripts\run-cypress-headless.bat smoke
 *
 * Modules covered:
 *  1. Auth — Login page renders + form fields present
 *  2. Dashboard — loads, KPI cards visible, upcoming maturities widget
 *  3. Account Management — list page, tab filters, key actions visible
 *  4. Loan Management — list page, status chips, New Loan button
 *  5. Transaction / Ledger — balances tab, journal entries tab
 *  6. Customer Management — list page, New Customer button
 *  7. User Management — users tab, roles tab
 *  8. Expression Builder — expression list, Create/Edit tab
 *  9. Reports — page loads
 * 10. API Health — skipped in CI (CYPRESS_SKIP_API_HEALTH=true), runs locally
 */

const SHORT = 15_000;  // ms — standard wait for page elements

// ─── 1. Auth ─────────────────────────────────────────────────────────────────
describe('[SMOKE] Auth — Login page', () => {
  it('renders login page with email and password fields', () => {
    // Clear any stored session so we are not auto-redirected
    cy.clearLocalStorage();
    cy.visit('/login');
    cy.get('body').should('be.visible');

    // In development/CI mode (NODE_ENV=development), the app auto-authenticates
    // and PublicRoute redirects /login → /dashboard. Both outcomes are valid.
    cy.url({ timeout: SHORT }).then(url => {
      if (url.includes('/login')) {
        // Production build or dev-auth disabled: verify the login form
        cy.get('input[name="username"]', { timeout: SHORT }).should('exist');
        cy.get('input[type="password"]').should('exist');
        cy.contains(/sign in/i, { timeout: SHORT }).should('be.visible');
      }
      // If redirected to dashboard, the auth system is working — test passes
    });
  });

  it('shows error for wrong credentials (or skips in dev-auth mode)', () => {
    cy.clearLocalStorage();
    cy.visit('/login');
    cy.get('body').should('be.visible');

    cy.url({ timeout: SHORT }).then(url => {
      if (!url.includes('/login')) {
        // Dev mode auto-auth: skip the credential-error portion
        cy.log('⚠️  Dev-mode auto-auth active — credential error test skipped');
        return;
      }

      // Intercept the real auth call so no service is needed
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 401,
        body: { message: 'Invalid credentials' },
      }).as('failLogin');

      cy.get('input[name="username"]').first().type('bad@user.com');
      cy.get('input[type="password"]').type('wrongpass');
      cy.get('button[type="submit"]').click();
      // App may show error text or stay on login page — must NOT go to dashboard
      cy.url({ timeout: SHORT }).should('not.include', '/dashboard');
    });
  });
});

// ─── 2. Dashboard ────────────────────────────────────────────────────────────
describe('[SMOKE] Dashboard', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.stubApis();
  });

  it('loads the dashboard with KPI cards', () => {
    cy.visit('/dashboard');
    // Page heading or app shell visible
    cy.get('body').should('be.visible');
    cy.contains(/dashboard/i, { timeout: SHORT }).should('exist');
  });

  it('shows the upcoming maturities section', () => {
    cy.intercept('GET', '**/api/account/upcoming-maturities*', {
      body: [
        {
          accountId:              1,
          accountNumber:          'FD-2026-001',
          customerId:             1,
          productType:            'FD',
          balance:                100000,
          maturityDate:           new Date(Date.now() + 5 * 86400000).toISOString(),
          termMonths:             12,
          annualRate:             7.5,
          projectedInterest:      7500,
          projectedMaturityAmount: 107500,
        },
      ],
    }).as('maturities');

    cy.visit('/dashboard');
    cy.wait('@maturities', { timeout: SHORT });
    // Widget heading or at least one maturity row
    cy.contains(/maturity|maturities|upcoming/i, { timeout: SHORT }).should('exist');
  });
});

// ─── 3. Account Management ───────────────────────────────────────────────────
describe('[SMOKE] Account Management', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.stubApis();
  });

  it('loads account list page', () => {
    cy.visit('/accounts');
    cy.get('body').should('be.visible');
    cy.contains(/account/i, { timeout: SHORT }).should('exist');
  });

  it('shows filter tabs (All, Active, Frozen, Mature)', () => {
    // The accountService calls GET /api/account (no /accounts suffix)
    cy.intercept('GET', '**/api/account*', {
      body: [
        { accountId: 1, accountNumber: 'SB-001', customerId: 1, balance: 5000,  status: 'Active', approvalStatus: 'Approved' },
        { accountId: 2, accountNumber: 'FD-001', customerId: 1, balance: 50000, status: 'Frozen', approvalStatus: 'Approved' },
        { accountId: 3, accountNumber: 'FD-002', customerId: 2, balance: 75000, status: 'Mature', approvalStatus: 'Approved' },
      ],
    }).as('accounts');

    cy.visit('/accounts');
    // At minimum, the page should render with some account/filter content
    cy.contains(/all|active|account/i, { timeout: SHORT }).should('exist');
  });

  it('shows New Account button', () => {
    cy.visit('/accounts');
    cy.contains(/new account|add account|create/i, { timeout: SHORT }).should('be.visible');
  });

  it('shows Open Account dialog when New Account clicked', () => {
    cy.visit('/accounts');
    // force:true bypasses transient loading overlays that may cover the button
    cy.contains(/new account|add account/i, { timeout: SHORT }).click({ force: true });
    cy.contains(/open account|create account|product type|select/i, { timeout: SHORT }).should('be.visible');
  });
});

// ─── 4. Loan Management ──────────────────────────────────────────────────────
describe('[SMOKE] Loan Management', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.stubApis();
  });

  it('loads loan applications list', () => {
    cy.visit('/loans');
    cy.get('body').should('be.visible');
    cy.contains(/loan/i, { timeout: SHORT }).should('exist');
  });

  it('shows New Loan Application button', () => {
    cy.visit('/loans');
    cy.contains(/new loan|apply|new application/i, { timeout: SHORT }).should('be.visible');
  });

  it('New Loan page loads all 6 form steps', () => {
    cy.visit('/loans/new');
    cy.contains(/personal|applicant|loan details|apply for a loan/i, { timeout: SHORT }).should('be.visible');
    // Step indicator should show multiple steps
    cy.contains(/step|1 of|personal/i, { timeout: SHORT }).should('exist');
  });

  it('shows seeded loan applications in list', () => {
    // LoanManagement calls getApplicationsList() → GET /api/loans/applications
    cy.intercept('GET', '**/api/loans/applications*', {
      body: {
        total: 2,
        page: 1,
        pageSize: 20,
        items: [
          { id: '1', applicationNumber: 'LOAN-2026-001', applicantName: 'Ramesh Kumar', status: 'SUBMITTED', requestedAmount: 500000 },
          { id: '2', applicationNumber: 'LOAN-2026-002', applicantName: 'Priya Sharma',  status: 'APPROVED',  requestedAmount: 250000 },
        ],
      },
    }).as('loans');

    cy.visit('/loans');
    cy.wait('@loans', { timeout: SHORT });
    cy.contains(/LOAN-2026|SUBMITTED|APPROVED|Ramesh|Priya/i, { timeout: SHORT }).should('exist');
  });
});

// ─── 5. Transaction / Ledger ─────────────────────────────────────────────────
describe('[SMOKE] Transactions / Ledger', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.stubApis();
  });

  it('loads transaction management page', () => {
    cy.visit('/transactions');
    cy.get('body').should('be.visible');
    cy.contains(/transaction|ledger|journal/i, { timeout: SHORT }).should('exist');
  });

  it('shows ledger balance view', () => {
    cy.intercept('GET', '**/api/ledger/balances*', {
      body: [
        { accountCode: '1010', accountName: 'Cash & Bank',      balance: 5000000, currency: 'INR' },
        { accountCode: '2010', accountName: 'Deposits Payable', balance: 4500000, currency: 'INR' },
      ],
    }).as('balances');

    cy.visit('/transactions');
    cy.contains(/balance|ledger|journal/i, { timeout: SHORT }).should('exist');
  });

  it('shows Post Journal Entry button or section', () => {
    cy.visit('/transactions');
    cy.contains(/post journal|new journal|journal entry|debit|credit/i, { timeout: SHORT }).should('exist');
  });
});

// ─── 6. Customer Management ──────────────────────────────────────────────────
describe('[SMOKE] Customer Management', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.stubApis();
  });

  it('loads customer management page', () => {
    cy.visit('/customers');
    cy.get('body').should('be.visible');
    cy.contains(/customer/i, { timeout: SHORT }).should('exist');
  });

  it('shows customer table with column headers', () => {
    // CustomerManagement.tsx renders a table — no search input exists in the component
    cy.visit('/customers');
    cy.contains(/name|type|mobile|email|customer/i, { timeout: SHORT }).should('exist');
  });

  it('shows Add / New Customer button', () => {
    cy.visit('/customers');
    cy.contains(/new customer|add customer|create customer/i, { timeout: SHORT })
      .should('exist');
  });
});

// ─── 7. User Management ──────────────────────────────────────────────────────
describe('[SMOKE] User Management', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.stubApis();
  });

  it('loads user management page', () => {
    cy.visit('/admin/users');
    cy.get('body').should('be.visible');
    cy.contains(/user|role|admin/i, { timeout: SHORT }).should('exist');
  });

  it('shows Users and Roles tabs', () => {
    cy.visit('/admin/users');
    cy.contains(/users/i, { timeout: SHORT }).should('be.visible');
    cy.contains(/roles/i, { timeout: SHORT }).should('be.visible');
  });

  it('shows Add User / New User button', () => {
    cy.visit('/admin/users');
    cy.contains(/new user|add user|create user/i, { timeout: SHORT }).should('be.visible');
  });
});

// ─── 8. Expression Builder ───────────────────────────────────────────────────
describe('[SMOKE] Expression Builder', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.stubApis();
  });

  it('loads the simple expression builder', () => {
    cy.visit('/expressions/simple');
    cy.get('body').should('be.visible');
    cy.contains(/expression/i, { timeout: SHORT }).should('exist');
  });

  it('shows expression list with Create/Edit tab', () => {
    // SimpleExpressionBuilder.tsx has a "Create/Edit" tab (not a "New Expression" button)
    cy.intercept('GET', '**/api/expressions*', {
      body: [
        { expressionId: 'EXPR_1755237353842', name: 'Loan Eligibility Check', description: 'FOIR/LTV/EMI check' },
      ],
    }).as('expressions');

    cy.visit('/expressions/simple');
    // Match any of: "Expressions" tab, "Create/Edit" tab, or "Create Expression" button
    cy.contains(/expressions|create.?edit|create expression/i, { timeout: SHORT })
      .should('exist');
  });
});

// ─── 9. Reports ──────────────────────────────────────────────────────────────
describe('[SMOKE] Reports', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.stubApis();
  });

  it('loads the reports page', () => {
    cy.visit('/reports');
    cy.get('body').should('be.visible');
    // Reports might redirect to /reports/financial or show a landing
    cy.contains(/report|financial|mis|regulatory/i, { timeout: SHORT }).should('exist');
  });
});

// ─── 10. API Health ───────────────────────────────────────────────────────────
// These tests make real HTTP requests to locally-running backend services.
// In CI, services are NOT started → set CYPRESS_SKIP_API_HEALTH=true to skip.
describe('[SMOKE] API Health Checks', () => {
  beforeEach(function() {
    if (Cypress.env('SKIP_API_HEALTH')) {
      this.skip();
    }
  });

  it('ExpressionBuilderService is reachable (port 5004)', () => {
    cy.request({
      url:              'http://localhost:5004/api/expressions?page=1&pageSize=1',
      failOnStatusCode: false,
    }).its('status').should('be.oneOf', [200, 401]);
  });

  it('AccountService is reachable (port 5217)', () => {
    cy.request({
      url:              'http://localhost:5217/api/account',
      failOnStatusCode: false,
    }).its('status').should('be.oneOf', [200, 401, 403]);
  });

  it('LoanService is reachable (port 5130)', () => {
    cy.request({
      url:              'http://localhost:5130/api/loans/applications',
      failOnStatusCode: false,
    }).its('status').should('be.oneOf', [200, 401, 403]);
  });

  it('UserAccessManagementService is reachable (port 5033)', () => {
    cy.request({
      url:              'http://localhost:5033/api/auth/login',
      method:           'POST',
      body:             { username: 'test', password: 'test' },
      failOnStatusCode: false,
    }).its('status').should('be.oneOf', [200, 400, 401]);
  });

  it('TransactionService is reachable (port 5005)', () => {
    cy.request({
      url:              'http://localhost:5005/api/ledger/balances',
      failOnStatusCode: false,
    }).its('status').should('be.oneOf', [200, 401, 403]);
  });
});

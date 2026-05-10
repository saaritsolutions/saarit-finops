export {};

declare global {
  namespace Cypress {
    interface Chainable {
      /** Quick mock login — sets a demo JWT in localStorage (no backend needed) */
      loginAsDemo(): Chainable<void>;
      /** Real login via UAM service — requires UAM running on port 5033 */
      loginViaApi(email?: string, password?: string): Chainable<void>;
      /** Intercept all common API calls with empty/minimal fixture data */
      stubApis(): Chainable<void>;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock login — sets a demo JWT with Redux authSlice so the app considers
// the session valid. This properly initializes both auth token and feature flags.
// ─────────────────────────────────────────────────────────────────────────────
Cypress.Commands.add('loginAsDemo', () => {
  const mockJwt = btoa(
    JSON.stringify({ user_id: 'demo', bank_name: 'Demo Bank', tenant_id: 'public' })
  );
  const fakeToken = `fake.${mockJwt}.signature`;
  window.localStorage.setItem('auth-token', fakeToken);
  window.localStorage.setItem('authSlice', JSON.stringify({
    isAuthenticated: true,
    user: { userId: 'demo', bankName: 'Demo Bank' },
    tenantId: 'public',
    featureFlags: {
      feature_gold_loan: true,
      feature_dynamic_forms: true,
      feature_expressions: true,
      feature_approval_chain: true,
      feature_compliance_alerts: true,
      feature_fd_rd: true,
    },
  }));
});

// ─────────────────────────────────────────────────────────────────────────────
// Real login — POSTs to UAM service on port 5033 and stores the real JWT.
// Requires UserAccessManagementService to be running.
// Falls back to demo mock token if UAM is not reachable.
// ─────────────────────────────────────────────────────────────────────────────
Cypress.Commands.add('loginViaApi', (
  email = 'admin@ucb-demo.com',
  password = 'ucb123',
) => {
  cy.request({
    method:            'POST',
    url:               'http://localhost:5033/api/auth/login',
    body:              { username: email, password },
    failOnStatusCode:  false,
  }).then((res) => {
    if (res.status === 200 && res.body?.token) {
      window.localStorage.setItem('auth-token', res.body.token);
    } else {
      // Service not running — fall back to mock so UI at least renders
      cy.log('⚠️  UAM not reachable — using mock JWT');
      window.localStorage.setItem('auth-token', `mock-jwt-token-${Date.now()}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stub common API calls with minimal data so page skeletons resolve quickly.
// Call this before visiting a page in smoke tests.
// ─────────────────────────────────────────────────────────────────────────────
Cypress.Commands.add('stubApis', () => {
  // Accounts — accountService calls GET /api/account (base route, no /accounts suffix)
  cy.intercept('GET', '**/api/account*', { body: [] }).as('getAccounts');
  // Loans — loanOriginationService calls GET /api/loans/applications and /api/LoanOrigination
  cy.intercept('GET', '**/api/loans*', { body: { total: 0, items: [], page: 1, pageSize: 20 } }).as('getLoans');
  cy.intercept('GET', '**/api/LoanOrigination*', { body: [] }).as('getLoanOrig');
  cy.intercept('GET', '**/api/LoanApplications*', { body: [] }).as('getLoanApplications');
  cy.intercept('GET', '**/api/LoanProducts*', { body: [] }).as('getLoanProducts');
  // Customers — customerService calls GET /api/customer (base route)
  cy.intercept('GET', '**/api/customer*', { body: [] }).as('getCustomers');
  // Transactions / Ledger
  cy.intercept('GET', '**/api/ledger*', { body: [] }).as('getLedger');
  cy.intercept('GET', '**/api/transaction*', { body: [] }).as('getTransactions');
  cy.intercept('GET', '**/api/journals*', { body: [] }).as('getJournals');
  // Users / Roles
  cy.intercept('GET', '**/api/uam/users*', { body: [] }).as('getUsers');
  cy.intercept('GET', '**/api/users*', { body: [] }).as('getUsersAlt');
  cy.intercept('GET', '**/api/roles*', { body: [] }).as('getRoles');
  // Expressions
  cy.intercept('GET', '**/api/expressions*', { body: [] }).as('getExpressions');
  cy.intercept('GET', '**/api/Expressions*', { body: [] }).as('getExpressionsAlt');
  // DFS — LoanOrigination fetches PERSONAL_LOAN schema on mount (SAAR-DFS-003)
  cy.intercept('GET', '**/api/forms*', {
    body: {
      formType: 'PERSONAL_LOAN', tenantId: 'public', version: 1, isDefault: true,
      updatedAt: new Date().toISOString(),
      schema: JSON.stringify({ title: 'Personal Loan', fields: [], sections: [] }),
    },
  }).as('getDfsSchema');
  // Reports
  cy.intercept('GET', '**/api/reports*', { body: [] }).as('getReports');
});

// Enable Testing Library commands (findByLabelText, etc.)
import '@testing-library/cypress/add-commands';

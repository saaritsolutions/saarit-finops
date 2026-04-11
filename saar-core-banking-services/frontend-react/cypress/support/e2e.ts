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
// Mock login — sets a plausible-looking JWT so the Redux store considers the
// session valid. The mock fallback in authSlice accepts "mock-jwt-token-*".
// ─────────────────────────────────────────────────────────────────────────────
Cypress.Commands.add('loginAsDemo', () => {
  window.localStorage.setItem('auth-token', `mock-jwt-token-${Date.now()}`);
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
  // Accounts
  cy.intercept('GET', '**/api/account/accounts*', { body: [] }).as('getAccounts');
  cy.intercept('GET', '**/api/account/product-types*', { body: [] }).as('getProductTypes');
  cy.intercept('GET', '**/api/account/upcoming-maturities*', { body: [] }).as('getMaturities');
  // Loans
  cy.intercept('GET', '**/api/LoanApplications*', { body: [] }).as('getLoans');
  cy.intercept('GET', '**/api/LoanProducts*', { body: [] }).as('getLoanProducts');
  cy.intercept('GET', '**/api/loan*', { body: [] }).as('getLoan');
  // Customers
  cy.intercept('GET', '**/api/customer/customers*', { body: [] }).as('getCustomers');
  // Transactions / Ledger
  cy.intercept('GET', '**/api/ledger/balances*', { body: [] }).as('getLedgerBalances');
  cy.intercept('GET', '**/api/transaction*', { body: [] }).as('getTransactions');
  cy.intercept('GET', '**/api/journals*', { body: [] }).as('getJournals');
  // Users / Roles
  cy.intercept('GET', '**/api/uam/users*', { body: [] }).as('getUsers');
  cy.intercept('GET', '**/api/users*', { body: [] }).as('getUsersAlt');
  cy.intercept('GET', '**/api/roles*', { body: [] }).as('getRoles');
  // Expressions
  cy.intercept('GET', '**/api/expressions*', { body: [] }).as('getExpressions');
  cy.intercept('GET', '**/api/Expressions*', { body: [] }).as('getExpressionsAlt');
  // Reports
  cy.intercept('GET', '**/api/reports*', { body: [] }).as('getReports');
});

// Enable Testing Library commands (findByLabelText, etc.)
import '@testing-library/cypress/add-commands';

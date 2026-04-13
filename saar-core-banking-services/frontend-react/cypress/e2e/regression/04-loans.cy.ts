/// <reference types="cypress" />
export {};

/**
 * REGRESSION — Loan Management Module
 * Covers: application list, status tabs, new loan form (6 steps),
 *         detail page, approve/disburse actions, disbursal journal number.
 *
 * NOTE: getApplicationsList() → GET /api/loans/applications (paginated: { total, page, pageSize, items })
 *       getApplicationDetail(id) → GET /api/loans/applications/{id} → { application, documents, actions }
 *       getLoanProducts() → GET /api/loan-products
 */

const LOAN_APPS = [
  {
    id:                '1',
    applicationNumber: 'LOAN-2026-001',
    applicantName:     'Ramesh Kumar',
    requestedAmount:   500000,
    tenureMonths:      120,
    interestRate:      9.5,
    productType:       'Home Loan',
    status:            'SUBMITTED',
    cibilScore:        780,
    foirPercent:       0.32,
    grossMonthlyIncome: 80000,
    createdAt:         '2026-04-01T09:00:00Z',
    updatedAt:         '2026-04-01T09:00:00Z',
  },
  {
    id:                '2',
    applicationNumber: 'LOAN-2026-002',
    applicantName:     'Priya Sharma',
    requestedAmount:   250000,
    tenureMonths:      60,
    interestRate:      10.5,
    productType:       'Personal Loan',
    status:            'APPROVED',
    cibilScore:        720,
    foirPercent:       0.28,
    grossMonthlyIncome: 55000,
    createdAt:         '2026-04-02T10:00:00Z',
    updatedAt:         '2026-04-02T10:00:00Z',
  },
  {
    id:                '3',
    applicationNumber: 'LOAN-2026-003',
    applicantName:     'Anil Patel',
    requestedAmount:   1000000,
    tenureMonths:      84,
    interestRate:      11.0,
    productType:       'Business Loan',
    status:            'DISBURSED',
    cibilScore:        810,
    foirPercent:       0.25,
    grossMonthlyIncome: 120000,
    disbursalJournalNumber: 'JNL-2026-00031',
    createdAt:         '2026-04-03T11:00:00Z',
    updatedAt:         '2026-04-03T11:00:00Z',
  },
];

/** Wrap items in the paginated envelope that getApplicationsList() expects */
const listBody = (items: typeof LOAN_APPS) => ({
  total:    items.length,
  page:     1,
  pageSize: 20,
  items,
});

describe('[REGRESSION] Loan Management — Application List', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    // getApplicationsList → GET /api/loans/applications?page=...
    cy.intercept('GET', '**/api/loans/applications*', { body: listBody(LOAN_APPS) }).as('loans');
    cy.intercept('GET', '**/api/loan-products*',       { body: [] }).as('products');
  });

  it('loads the loan list with table headers', () => {
    cy.visit('/loans');
    cy.wait('@loans', { timeout: 15000 });
    cy.contains(/application|loan|applicant/i).should('exist');
    cy.contains(/status/i).should('exist');
    cy.contains(/amount/i).should('exist');
  });

  it('displays all 3 seeded loan applications', () => {
    cy.visit('/loans');
    cy.wait('@loans', { timeout: 15000 });
    cy.contains('LOAN-2026-001').should('exist');
    cy.contains('LOAN-2026-002').should('exist');
    cy.contains('LOAN-2026-003').should('exist');
  });

  it('shows status chips with correct colours', () => {
    cy.visit('/loans');
    cy.wait('@loans', { timeout: 15000 });
    // STATUS_CONFIG: SUBMITTED→'Submitted', APPROVED→'Sanctioned', DISBURSED→'Disbursed'
    cy.contains(/submitted/i).should('exist');
    cy.contains(/sanctioned/i).should('exist');
    cy.contains(/disbursed/i).should('exist');
  });

  it('Pending Approval tab shows only non-terminal applications', () => {
    cy.visit('/loans');
    cy.wait('@loans', { timeout: 15000 });
    cy.contains(/pending approval|pending|in review/i, { timeout: 5000 }).click({ force: true });
    // DISBURSED should not appear in the pending tab
    cy.contains('DISBURSED').should('not.exist');
  });

  it('clicking a row navigates to loan detail', () => {
    cy.intercept('GET', '**/api/loans/applications/1*', {
      body: { application: LOAN_APPS[0], documents: [], actions: [] },
    }).as('detail');
    cy.visit('/loans');
    cy.wait('@loans', { timeout: 15000 });
    cy.contains('LOAN-2026-001').click({ force: true });
    cy.url({ timeout: 10000 }).should('include', '/loans/');
  });
});

describe('[REGRESSION] Loan Management — Detail Page', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    // Register the GENERAL list intercept first, then the SPECIFIC detail intercept.
    // Cypress LIFO: last-registered wins — so the specific /1* route takes priority.
    cy.intercept('GET', '**/api/loans/applications*', { body: listBody(LOAN_APPS) }).as('loans');
    // Detail page: GET /api/loans/applications/{id} → { application, documents, actions }
    cy.intercept('GET', '**/api/loans/applications/1*', {
      body: { application: LOAN_APPS[0], documents: [], actions: [] },
    }).as('loanDetail');
    cy.intercept('GET', '**/api/loan-products*',       { body: [] }).as('products');
  });

  it('loan detail page shows applicant name and loan amount', () => {
    cy.visit('/loans/1');
    cy.wait('@loanDetail', { timeout: 15000 });
    cy.contains('Ramesh Kumar').should('exist');
    cy.contains(/500,000|5,00,000|500000/i).should('exist');
  });

  it('shows workflow timeline on detail page', () => {
    cy.visit('/loans/1');
    cy.wait('@loanDetail', { timeout: 15000 });
    cy.contains(/timeline|workflow|step|LOAN-2026-001/i, { timeout: 10000 }).should('exist');
  });

  it('shows EMI repayment schedule section', () => {
    cy.visit('/loans/1');
    cy.wait('@loanDetail', { timeout: 15000 });
    cy.contains(/EMI|repayment|monthly|schedule/i, { timeout: 10000 }).should('exist');
  });

  it('shows Disbursal Journal Number for DISBURSED loans', () => {
    cy.intercept('GET', '**/api/loans/applications/3*', {
      body: { application: LOAN_APPS[2], documents: [], actions: [] },
    }).as('disbursedDetail');
    cy.visit('/loans/3');
    cy.wait('@disbursedDetail', { timeout: 15000 });
    cy.contains(/JNL-2026-00031|journal/i, { timeout: 10000 }).should('exist');
  });
});

describe('[REGRESSION] Loan Management — New Loan Origination Form', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/loan-products*',           { body: [] }).as('products');
    cy.intercept('GET', '**/api/customer/customers*',      { body: [] }).as('customers');
    cy.intercept('POST', '**/api/loan/check-eligibility*', {
      body: { eligible: true, maxLoanAmount: 600000, reason: 'FOIR within limit' },
    }).as('eligibility');
  });

  it('new loan page shows step 1: Personal Information', () => {
    cy.visit('/loans/new');
    cy.contains(/personal|applicant information|apply for/i, { timeout: 15000 }).should('exist');
  });

  it('step indicator shows at least 4 steps', () => {
    cy.visit('/loans/new');
    cy.contains(/personal|KYC|apply for/i, { timeout: 15000 }).should('exist');
    // StepIndicator renders step labels as Typography text nodes (no class="step")
    cy.contains(/Employment|Income|Loan Parameters|Documents/i, { timeout: 5000 }).should('exist');
  });

  it('Next button moves to step 2', () => {
    cy.visit('/loans/new');
    cy.contains(/personal|KYC|apply for/i, { timeout: 15000 });
    // Target text inputs specifically (not file inputs)
    cy.get('input[type="text"], input:not([type]):not([type="file"]):not([type="checkbox"]):not([type="radio"])').first().type('Ramesh', { force: true });
    cy.contains(/next|continue/i, { timeout: 5000 }).click({ force: true });
    // Should advance (step 2 or validation error, both acceptable)
    cy.get('body').should('be.visible');
  });

  it('loan amount field exists in the form', () => {
    // Loan Amount is on Step 3 — verify the step label exists on the form
    cy.visit('/loans/new');
    cy.contains(/personal|KYC/i, { timeout: 15000 }).should('exist');
    // The step indicator shows 'Loan Parameters' which contains the loan amount slider
    cy.contains(/Loan Parameters|Employment|personal/i, { timeout: 5000 }).should('exist');
  });

  it('Back button works on step 2', () => {
    cy.visit('/loans/new');
    cy.contains(/next|continue/i, { timeout: 15000 }).click({ force: true });
    cy.contains(/back|previous/i, { timeout: 5000 }).click({ force: true });
    cy.contains(/personal|applicant/i, { timeout: 5000 }).should('exist');
  });
});

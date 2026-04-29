/// <reference types="cypress" />
export {};

/**
 * REGRESSION — Loan Restructuring (SAAR-LRP-003)
 * Covers: T-04 restructure button on LoanDetail, T-05 dialog + RESTRUCTURED chip,
 *         T-06 Reports Restructured tab.
 *
 * POST /api/loans/{id}/restructure — absolute route (not /api/loans/applications/…)
 * GET  /api/loans/applications/restructured — controller-prefix relative route
 */

const LOAN_ID = 'bbbb-1234-5678-9abc';

const DISBURSED_LOAN = {
  application: {
    id:                LOAN_ID,
    applicationNumber: 'LOAN-0042',
    applicantName:     'Suresh Kumar',
    productType:       'Personal Loan',
    status:            'DISBURSED',
    isRestructured:    false,
    sanctionedAmount:  200000,
    requestedAmount:   200000,
    interestRate:      12,
    tenureMonths:      36,
    outstandingPrincipal: 180000,
    nextDueDate:       '2026-05-29',
    createdAt:         '2025-11-01T10:00:00Z',
    disbursedAt:       '2025-11-10T10:00:00Z',
  },
  documents: [],
  actions:   [],
};

const DISBURSED_AFTER_RESTRUCTURE = {
  ...DISBURSED_LOAN,
  application: {
    ...DISBURSED_LOAN.application,
    isRestructured:              true,
    restructuredDate:            '2026-04-29T09:00:00Z',
    restructuredNewEmi:          8500,
    restructuredNewTenureMonths: 84,
    restructuredNewInterestRate: 9.5,
    restructuredReason:          'Borrower lost primary income source',
  },
};

const RESTRUCTURED_LIST_RESPONSE = {
  total: 1,
  items: [
    {
      id:                          LOAN_ID,
      applicationNumber:           'LOAN-0042',
      applicantName:               'Suresh Kumar',
      productType:                 'Personal Loan',
      outstandingPrincipal:        180000,
      smaStatus:                   'SMA-1',
      overdueDays:                 45,
      restructuredDate:            '2026-04-29T09:00:00Z',
      restructuredNewEmi:          8500,
      restructuredNewTenureMonths: 84,
      restructuredNewInterestRate: 9.5,
      restructuredReason:          'Borrower lost primary income source',
      requiredProvisioningPct:     5,
      requiredProvisioning:        9000,
    },
  ],
};

describe('[REGRESSION] Loan Restructuring (SAAR-LRP-003)', () => {
  // ── T-04: Restructure button visible on DISBURSED non-restructured loan ─────
  it('T-04 — Restructure button is visible for a DISBURSED non-restructured loan', () => {
    cy.loginAsDemo();
    cy.intercept('GET', `**/api/loans/applications/${LOAN_ID}`, { body: DISBURSED_LOAN }).as('loanDetail');
    cy.intercept('GET', `**/api/approval/chain*`, { body: { steps: [] } }).as('approvalChain');

    cy.visit(`/loans/${LOAN_ID}`);
    cy.wait('@loanDetail', { timeout: 15000 });

    cy.get('[aria-label="restructure loan"]').should('exist');
    cy.contains('button', /Restructure Loan/i).should('exist');
  });

  // ── T-05: Restructure dialog submits and RESTRUCTURED chip appears ──────────
  it('T-05 — Restructure dialog submits and RESTRUCTURED chip is shown', () => {
    cy.loginAsDemo();

    // First load: non-restructured
    cy.intercept('GET', `**/api/loans/applications/${LOAN_ID}`, { body: DISBURSED_LOAN }).as('loanDetail');
    cy.intercept('GET', `**/api/approval/chain*`, { body: { steps: [] } }).as('approvalChain');
    cy.intercept('POST', `**/api/loans/${LOAN_ID}/restructure`, { statusCode: 200, body: {
      applicationNumber: 'LOAN-0042',
      isRestructured:    true,
      restructuredDate:  '2026-04-29T09:00:00Z',
      newMonthlyEmi:     8500,
      newTenureMonths:   84,
      newInterestRate:   9.5,
    }}).as('restructure');

    cy.visit(`/loans/${LOAN_ID}`);
    cy.wait('@loanDetail', { timeout: 15000 });

    // Open dialog
    cy.contains('button', /Restructure Loan/i).click();
    cy.get('[role="dialog"]').should('be.visible');

    // Fill in all 4 fields
    cy.get('[role="dialog"]').find('input[type="number"]').eq(0).clear().type('8500').blur();
    cy.get('[role="dialog"]').find('input[type="number"]').eq(1).clear().type('84').blur();
    cy.get('[role="dialog"]').find('input[type="number"]').eq(2).clear().type('9.5').blur();
    cy.get('[role="dialog"]').find('textarea').first().clear().type('Borrower lost primary income source').blur();

    // Submit button should be enabled
    cy.get('[aria-label="confirm restructure"]').should('not.be.disabled');

    // After submit — reload returns restructured version
    cy.intercept('GET', `**/api/loans/applications/${LOAN_ID}`, { body: DISBURSED_AFTER_RESTRUCTURE }).as('loanDetailReloaded');
    cy.get('[aria-label="confirm restructure"]').click();
    cy.wait('@restructure', { timeout: 10000 });
    cy.wait('@loanDetailReloaded', { timeout: 10000 });

    // RESTRUCTURED chip should appear
    cy.contains('RESTRUCTURED').should('exist');
    cy.contains(/Loan restructured successfully/i).should('exist');
  });

  // ── T-06: Reports Restructured tab loads table ──────────────────────────────
  it('T-06 — Reports Restructured tab loads the restructured loans table', () => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/loans/applications/restructured*', { body: RESTRUCTURED_LIST_RESPONSE }).as('restructuredList');

    cy.visit('/reports');
    cy.contains('[role="tab"]', /Restructured/i).click();
    cy.wait('@restructuredList', { timeout: 15000 });

    cy.contains(/Restructured Loans/i).should('exist');
    cy.contains('LOAN-0042').should('exist');
    cy.contains('Suresh Kumar').should('exist');
    cy.contains(/SMA-1/i).should('exist');
    // KPI row
    cy.contains(/Restructured Count/i).should('exist');
    cy.contains(/Required Provisioning/i).should('exist');
  });
});

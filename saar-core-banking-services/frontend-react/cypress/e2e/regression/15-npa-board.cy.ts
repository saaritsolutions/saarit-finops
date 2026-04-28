/// <reference types="cypress" />
export {};

/**
 * REGRESSION — NPA Board (SAAR-NPA-001)
 * Covers: page load, NPA loans table, SMA watch list.
 *
 * NOTE: GET /api/loans/npa-board is at absolute route (not /api/loans/applications/npa-board).
 *       npaLoans and smaWatchList are camelCase arrays in the JSON response.
 */

const NPA_BOARD_RESPONSE = {
  asOfDate:                  '2026-04-28',
  totalLoanBook:             1500000,
  totalNpaOutstanding:       150000,
  npaRatio:                  0.10,
  totalRequiredProvisioning: 22500,
  smaWatchCount:             2,
  smaWatchOutstanding:       200000,
  npaLoans: [
    {
      id:                   'aaa-111',
      applicationNumber:    'LOAN-NPA-001',
      applicantName:        'Ramesh Overdue',
      productType:          'Personal Loan',
      outstandingPrincipal: 150000,
      overdueDays:          95,
      smaStatus:            'NPA',
      npaSubClassification: 'SUB_STANDARD',
      requiredProvisioning: 22500,
    },
  ],
  smaWatchList: [
    {
      id:                   'bbb-222',
      applicationNumber:    'LOAN-SMA-001',
      applicantName:        'Priya AtRisk',
      productType:          'Home Loan',
      outstandingPrincipal: 100000,
      overdueDays:          45,
      smaStatus:            'SMA-1',
    },
  ],
};

describe('[REGRESSION] NPA Board (SAAR-NPA-001)', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/loans/npa-board*', { body: NPA_BOARD_RESPONSE }).as('npaBoard');
  });

  // T-04: NPA Board page loads and shows KPI cards
  it('T-04 — NPA Board page loads and shows KPI cards', () => {
    cy.visit('/npa-board');
    cy.wait('@npaBoard', { timeout: 15000 });

    // Page header
    cy.contains(/NPA Board/i).should('exist');

    // KPI cards
    cy.contains(/NPA Ratio/i).should('exist');
    cy.contains(/NPA Outstanding/i).should('exist');
    cy.contains(/Provisioning/i).should('exist');
    cy.contains(/SMA Watch/i).should('exist');
  });

  // T-05: NPA loans table renders seeded NPA entry with SUB_STANDARD chip
  it('T-05 — NPA loans table renders the seeded NPA loan', () => {
    cy.visit('/npa-board');
    cy.wait('@npaBoard', { timeout: 15000 });

    // NPA Accounts section
    cy.contains(/NPA Accounts/i).should('exist');

    // Application number and applicant
    cy.contains('LOAN-NPA-001').should('exist');
    cy.contains('Ramesh Overdue').should('exist');

    // Sub-Standard chip
    cy.contains(/Sub-Standard/i).should('exist');
  });

  // T-06: SMA Watch List shows the SMA-1 entry
  it('T-06 — SMA Watch List shows the seeded SMA-1 loan', () => {
    cy.visit('/npa-board');
    cy.wait('@npaBoard', { timeout: 15000 });

    // SMA Watch section
    cy.contains(/SMA Watch List/i).should('exist');

    // SMA-1 entry
    cy.contains('LOAN-SMA-001').should('exist');
    cy.contains('Priya AtRisk').should('exist');
    cy.contains('SMA-1').should('exist');
  });
});

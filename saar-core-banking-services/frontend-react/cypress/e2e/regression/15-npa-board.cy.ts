/// <reference types="cypress" />
export {};

/**
 * REGRESSION — NPA Board (SAAR-NPA-001 + SAAR-NPA-002)
 * Covers: page load, NPA loans table, SMA watch list, write-off flow.
 *
 * NOTE: GET /api/loans/npa-board is at absolute route (not /api/loans/applications/npa-board).
 *       npaLoans, smaWatchList, writtenOffLoans are camelCase arrays in the JSON response.
 */

const NPA_BOARD_RESPONSE = {
  asOfDate:                  '2026-04-28',
  totalLoanBook:             1500000,
  totalNpaOutstanding:       150000,
  npaRatio:                  0.10,
  totalRequiredProvisioning: 22500,
  smaWatchCount:             2,
  smaWatchOutstanding:       200000,
  writtenOffCount:           1,
  writtenOffOutstanding:     80000,
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
    {
      id:                   'ccc-333',
      applicationNumber:    'LOAN-NPA-002',
      applicantName:        'Govind Defaulter',
      productType:          'Business Loan',
      outstandingPrincipal: 200000,
      overdueDays:          1200,
      smaStatus:            'NPA',
      npaSubClassification: 'DOUBTFUL_3',
      requiredProvisioning: 200000,
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
  writtenOffLoans: [
    {
      id:                    'ddd-444',
      applicationNumber:     'LOAN-WO-001',
      applicantName:         'Shankar Written',
      productType:           'Vehicle Loan',
      outstandingPrincipal:  80000,
      writeOffDate:          '2026-04-25T10:00:00Z',
      writeOffReason:        'Borrower deceased',
      writeOffJournalNumber: 'JNL-20260425-000042',
    },
  ],
};

const NPA_BOARD_EMPTY = {
  asOfDate: '2026-04-28',
  totalLoanBook: 0,
  totalNpaOutstanding: 0,
  npaRatio: 0,
  totalRequiredProvisioning: 0,
  smaWatchCount: 0,
  smaWatchOutstanding: 0,
  writtenOffCount: 0,
  writtenOffOutstanding: 0,
  npaLoans: [],
  smaWatchList: [],
  writtenOffLoans: [],
};

describe('[REGRESSION] NPA Board (SAAR-NPA-001 + SAAR-NPA-002)', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/loans/npa-board*', { body: NPA_BOARD_RESPONSE }).as('npaBoard');
  });

  // T-04: NPA Board page loads and shows KPI cards
  it('T-04 — NPA Board page loads and shows KPI cards', () => {
    cy.visit('/npa-board');
    cy.wait('@npaBoard', { timeout: 15000 });

    cy.contains(/NPA Board/i).should('exist');
    cy.contains(/NPA Ratio/i).should('exist');
    cy.contains(/NPA Outstanding/i).should('exist');
    cy.contains(/Provisioning/i).should('exist');
    cy.contains(/SMA Watch/i).should('exist');
    cy.contains(/Written Off/i).should('exist');
  });

  // T-05: NPA loans table renders seeded NPA entries
  it('T-05 — NPA loans table renders the seeded NPA loans', () => {
    cy.visit('/npa-board');
    cy.wait('@npaBoard', { timeout: 15000 });

    cy.contains(/NPA Accounts/i).should('exist');
    cy.contains('LOAN-NPA-001').should('exist');
    cy.contains('Ramesh Overdue').should('exist');
    cy.contains(/Sub-Standard/i).should('exist');

    cy.contains('LOAN-NPA-002').should('exist');
    cy.contains('Govind Defaulter').should('exist');
    cy.contains(/Doubtful-3/i).should('exist');
  });

  // T-06: SMA Watch List shows the SMA-1 entry
  it('T-06 — SMA Watch List shows the seeded SMA-1 loan', () => {
    cy.visit('/npa-board');
    cy.wait('@npaBoard', { timeout: 15000 });

    cy.contains(/SMA Watch List/i).should('exist');
    cy.contains('LOAN-SMA-001').should('exist');
    cy.contains('Priya AtRisk').should('exist');
    cy.contains('SMA-1').should('exist');
  });

  // T-07: Write-off button appears ONLY for DOUBTFUL_3 rows
  it('T-07 — Write-off button appears only for DOUBTFUL_3 rows', () => {
    cy.visit('/npa-board');
    cy.wait('@npaBoard', { timeout: 15000 });

    // DOUBTFUL_3 row has write-off icon button
    cy.get('[aria-label="Write off LOAN-NPA-002"]').should('exist');

    // SUB_STANDARD row does NOT have write-off button
    cy.get('[aria-label="Write off LOAN-NPA-001"]').should('not.exist');
  });

  // T-08: Write-off dialog opens on button click and has required fields
  it('T-08 — Write-off dialog opens with reason and authorized-by fields', () => {
    cy.visit('/npa-board');
    cy.wait('@npaBoard', { timeout: 15000 });

    cy.get('[aria-label="Write off LOAN-NPA-002"]').click();

    cy.get('[role="dialog"]').should('exist');
    cy.get('[role="dialog"]').contains(/Confirm NPA Write-Off/i).should('exist');
    cy.get('[aria-label="write-off reason"]').should('exist');
    cy.get('[aria-label="write-off authorized by"]').should('exist');
    cy.get('[aria-label="confirm write off"]').should('exist');
  });

  // T-09: Written-off section shows the seeded written-off loan (collapsible)
  it('T-09 — Written-off loans section is present and shows LOAN-WO-001', () => {
    cy.visit('/npa-board');
    cy.wait('@npaBoard', { timeout: 15000 });

    // The Written-Off section header should be present
    cy.contains(/Written-Off Loans/i).should('exist');

    // Click to expand
    cy.contains(/Written-Off Loans/i).click();

    // Verify the written-off entry
    cy.contains('LOAN-WO-001').should('exist');
    cy.contains('Shankar Written').should('exist');
    cy.contains('Borrower deceased').should('exist');
  });
});

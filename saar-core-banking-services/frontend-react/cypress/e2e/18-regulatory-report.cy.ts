/// <reference types="cypress" />

/**
 * SAAR-RPT-002 — RBI Regulatory Reporting
 * Tests for regulatory metrics tab and compliance reporting
 */

describe('[REGRESSION] RBI Regulatory Reporting (SAAR-RPT-002)', () => {
  // ────────────────────────────────────────────────────────────────────────────
  // T-01: Reports Tab 7 "RBI Regulatory" loads with KPI cards
  // ────────────────────────────────────────────────────────────────────────────
  it('T-01: Reports Tab 7 "RBI Regulatory" loads and displays KPI cards', () => {
    cy.loginAsDemo();

    // Mock regulatory metrics endpoint
    cy.intercept('GET', '**/api/loans/reports/regulatory-summary', {
      statusCode: 200,
      body: {
        asOfDate: '2026-05-10',
        totalLoanBook: 825000,
        totalNpaOutstanding: 100000,
        npaRatio: 12.12,
        totalRequiredProvisioning: 25000,
        provisionCoverage: 25.0,
        restructuredCount: 1,
        restructuredOutstanding: 75000,
        restructuredRatio: 9.09,
        upgradedCount: 1,
        upgradedOutstanding: 50000,
        writtenOffCount: 1,
        writtenOffOutstanding: 50000,
        smaWatchCount: 2,
        smaWatchOutstanding: 100000,
        standardCount: 7,
        standardOutstanding: 625000,
      },
    }).as('getRegulatoryMetrics');

    cy.visit('/reports');

    // Click Tab 7 "RBI Regulatory"
    cy.get('#rpt-tab-7').should('be.visible');
    cy.get('#rpt-tab-7').click();

    // Wait for metrics to load
    cy.wait('@getRegulatoryMetrics');

    // Check title
    cy.get('h6').should('contain', 'RBI Regulatory Summary');

    // Check KPI cards are visible
    cy.contains('Total Loan Book').should('be.visible');
    cy.contains('NPA Outstanding').should('be.visible');
    cy.contains('NPA Ratio (%)').should('be.visible');
    cy.contains('Provision Coverage (%)').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-02: NPA ratio and provision coverage display correctly
  // ────────────────────────────────────────────────────────────────────────────
  it('T-02: NPA Ratio and Provision Coverage metrics display correctly', () => {
    cy.loginAsDemo();

    cy.intercept('GET', '**/api/loans/reports/regulatory-summary', {
      statusCode: 200,
      body: {
        asOfDate: '2026-05-10',
        totalLoanBook: 500000,
        totalNpaOutstanding: 0,
        npaRatio: 0.0,
        totalRequiredProvisioning: 0,
        provisionCoverage: 100.0,
        restructuredCount: 0,
        restructuredOutstanding: 0,
        restructuredRatio: 0.0,
        upgradedCount: 0,
        upgradedOutstanding: 0,
        writtenOffCount: 0,
        writtenOffOutstanding: 0,
        smaWatchCount: 0,
        smaWatchOutstanding: 0,
        standardCount: 10,
        standardOutstanding: 500000,
      },
    }).as('getRegulatoryMetrics');

    cy.visit('/reports');
    cy.get('#rpt-tab-7').click();
    cy.wait('@getRegulatoryMetrics');

    // Check that with all STANDARD loans, NPA ratio is 0%
    cy.contains('0.00%').should('be.visible');

    // Check provision coverage is 100%
    cy.contains('100.00%').should('be.visible');

    // Check standard count
    cy.contains('Standard').should('be.visible');
    cy.contains('10').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-03: CSV export button is visible and functional
  // ────────────────────────────────────────────────────────────────────────────
  it('T-03: CSV export button is visible and clickable', () => {
    cy.loginAsDemo();

    cy.intercept('GET', '**/api/loans/reports/regulatory-summary', {
      statusCode: 200,
      body: {
        asOfDate: '2026-05-10',
        totalLoanBook: 825000,
        totalNpaOutstanding: 100000,
        npaRatio: 12.12,
        totalRequiredProvisioning: 25000,
        provisionCoverage: 25.0,
        restructuredCount: 1,
        restructuredOutstanding: 75000,
        restructuredRatio: 9.09,
        upgradedCount: 1,
        upgradedOutstanding: 50000,
        writtenOffCount: 1,
        writtenOffOutstanding: 50000,
        smaWatchCount: 2,
        smaWatchOutstanding: 100000,
        standardCount: 7,
        standardOutstanding: 625000,
      },
    }).as('getRegulatoryMetrics');

    cy.visit('/reports');
    cy.get('#rpt-tab-7').click();
    cy.wait('@getRegulatoryMetrics');

    // Export CSV button should be visible
    cy.contains('button', 'Export CSV').should('be.visible');

    // Export button should not be disabled
    cy.contains('button', 'Export CSV').should('not.be.disabled');

    // Click should trigger download (button click succeeds)
    cy.contains('button', 'Export CSV').click();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-04: Restructured, Upgraded, and Written-Off counts display correctly
  // ────────────────────────────────────────────────────────────────────────────
  it('T-04: Restructured, Upgraded, Written-Off counts display correctly', () => {
    cy.loginAsDemo();

    cy.intercept('GET', '**/api/loans/reports/regulatory-summary', {
      statusCode: 200,
      body: {
        asOfDate: '2026-05-10',
        totalLoanBook: 825000,
        totalNpaOutstanding: 100000,
        npaRatio: 12.12,
        totalRequiredProvisioning: 25000,
        provisionCoverage: 25.0,
        restructuredCount: 3,
        restructuredOutstanding: 225000,
        restructuredRatio: 27.27,
        upgradedCount: 2,
        upgradedOutstanding: 100000,
        writtenOffCount: 5,
        writtenOffOutstanding: 250000,
        smaWatchCount: 2,
        smaWatchOutstanding: 100000,
        standardCount: 7,
        standardOutstanding: 625000,
      },
    }).as('getRegulatoryMetrics');

    cy.visit('/reports');
    cy.get('#rpt-tab-7').click();
    cy.wait('@getRegulatoryMetrics');

    // Check KPI cards for restructured loans
    cy.contains('Restructured Count').parent().should('contain', '3');

    // Check KPI cards for upgraded loans
    cy.contains('Upgraded Count').parent().should('contain', '2');

    // Check KPI cards for written-off loans
    cy.contains('Written-Off Count').parent().should('contain', '5');

    // Check SMA Watch count
    cy.contains('SMA Watch Count').parent().should('contain', '2');

    // Check summary table for Restructured row
    cy.get('table').should('contain', 'Restructured');
    cy.get('table').should('contain', '3');

    // Check summary table for Written-Off row
    cy.get('table').should('contain', 'Written-Off');
    cy.get('table').should('contain', '5');
  });
});

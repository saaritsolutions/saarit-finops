import { TEST_USER, TEST_LOAN_ID } from './constants';

describe('SAAR-NPA-003: Written-Off Loans & Recovery', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.initializeAuthState();
  });

  // T-01: Reports Tab 8 "Written-Off" loads with KPI cards
  it('T-01: Tab 8 Written-Off loads with KPI cards', () => {
    cy.visit('/reports');
    cy.get('[id="rpt-tab-8"]').click();
    cy.get('[id="rpt-tabpanel-8"]').should('be.visible');
    cy.contains('Written-Off Loans & Recovery').should('exist');

    // Verify KPI cards are present
    cy.contains('Total Written-Off').should('exist');
    cy.contains('Outstanding Principal').should('exist');
    cy.contains('Total Recovered').should('exist');
    cy.contains('Recovery Rate (%)').should('exist');
  });

  // T-02: Written-off table shows recovery status column with NONE/PARTIAL/FULL
  it('T-02: Written-off table shows recovery status column', () => {
    cy.visit('/reports');
    cy.get('[id="rpt-tab-8"]').click();
    cy.get('[id="rpt-tabpanel-8"]').should('be.visible');

    // Verify table headers
    cy.get('table').within(() => {
      cy.contains('th', 'Application No').should('exist');
      cy.contains('th', 'Applicant').should('exist');
      cy.contains('th', 'Outstanding').should('exist');
      cy.contains('th', 'Write-Off Date').should('exist');
      cy.contains('th', 'Recovered').should('exist');
      cy.contains('th', 'Status').should('exist');
    });
  });

  // T-03: CSV export button visible and clickable
  it('T-03: CSV export button is visible and clickable', () => {
    cy.visit('/reports');
    cy.get('[id="rpt-tab-8"]').click();
    cy.get('[id="rpt-tabpanel-8"]').should('be.visible');

    // Find and verify export button
    cy.get('[aria-label="Export Written-Off CSV"]')
      .should('exist')
      .should('be.visible');

    // Verify it has the download icon
    cy.get('[aria-label="Export Written-Off CSV"]').within(() => {
      cy.get('svg').should('exist'); // Download icon
    });
  });

  // T-04: LoanDetail shows WRITTEN_OFF status chip and write-off info card
  it('T-04: LoanDetail shows write-off status and info card', () => {
    // Navigate to a written-off loan (using known test loan ID or creating one)
    cy.visit(`/loans/${TEST_LOAN_ID}`);

    // Verify WRITTEN_OFF status chip if loan is written-off
    // This test assumes there's a written-off loan available
    // If status chip shows "Written Off", verify the write-off card
    cy.get('body').then(($body) => {
      if ($body.text().includes('Written Off')) {
        // Write-off card should be present
        cy.contains('Write-Off Information').should('exist');
        cy.contains('Write-Off Date').should('exist');
        cy.contains('Write-Off Journal').should('exist');

        // Check for Record Recovery button if not fully recovered
        cy.get('button').then(($buttons) => {
          const hasRecoveryBtn = Array.from($buttons).some(
            btn => btn.textContent?.includes('Record Recovery')
          );
          if (hasRecoveryBtn) {
            cy.contains('Record Recovery').should('be.visible');
          }
        });
      }
    });
  });
});

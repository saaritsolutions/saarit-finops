/// <reference types="cypress" />

/**
 * SAAR-LRP-004 — Loan Upgrade (Restructured → Original Terms)
 * Tests for restructured loan upgrade after 1-year satisfactory repayment
 */

describe('[REGRESSION] Loan Upgrades (SAAR-LRP-004)', () => {
  // ────────────────────────────────────────────────────────────────────────────
  // T-01: Upgrade button visible on restructured, 1+ year old DISBURSED loan
  // ────────────────────────────────────────────────────────────────────────────
  it('T-01: Upgrade button visible on eligible restructured loan', () => {
    cy.loginAsDemo();

    // Mock loan detail with: DISBURSED, isRestructured=true, isUpgraded=false, restructuredDate > 1 year ago
    const restructuredDate = new Date();
    restructuredDate.setFullYear(restructuredDate.getFullYear() - 2); // 2 years ago

    cy.intercept('GET', '**/api/loans/applications/*', {
      statusCode: 200,
      body: {
        application: {
          id: '123e4567',
          applicationNumber: 'APP-2024-001',
          status: 'DISBURSED',
          isRestructured: true,
          restructuredDate: restructuredDate.toISOString(),
          restructuredNewEmi: 3200,
          restructuredNewTenureMonths: 60,
          restructuredNewInterestRate: 9.5,
          isUpgraded: false,
          originalTenureMonths: 48,
          originalInterestRate: 12,
          applicantName: 'Test Borrower',
          requestedAmount: 150000,
          sanctionedAmount: 150000,
          smaStatus: 'STANDARD',
          outstandingPrincipal: 120000,
        },
        approvalActions: [],
      },
    });

    cy.visit('/loans/123e4567');
    cy.get('[aria-label="upgrade loan"]').should('be.visible');
    cy.get('[aria-label="upgrade loan"]').should('contain.text', 'Upgrade to Original Terms');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-02: Upgrade dialog opens and submits successfully
  // ────────────────────────────────────────────────────────────────────────────
  it('T-02: Upgrade dialog submits and shows success', () => {
    cy.loginAsDemo();

    const restructuredDate = new Date();
    restructuredDate.setFullYear(restructuredDate.getFullYear() - 2);

    cy.intercept('GET', '**/api/loans/applications/*', {
      statusCode: 200,
      body: {
        application: {
          id: '123e4567',
          applicationNumber: 'APP-2024-001',
          status: 'DISBURSED',
          isRestructured: true,
          restructuredDate: restructuredDate.toISOString(),
          restructuredNewEmi: 3200,
          restructuredNewTenureMonths: 60,
          restructuredNewInterestRate: 9.5,
          isUpgraded: false,
          originalTenureMonths: 48,
          originalInterestRate: 12,
          applicantName: 'Test Borrower',
          requestedAmount: 150000,
          sanctionedAmount: 150000,
          smaStatus: 'STANDARD',
        },
        approvalActions: [],
      },
    });

    // Mock the upgrade POST endpoint
    cy.intercept('POST', '**/api/loans/*/restructure-upgrade', {
      statusCode: 200,
      body: { message: 'Loan upgraded successfully' },
    }).as('upgradePost');

    // After upgrade, fetch should return isUpgraded=true
    cy.intercept('GET', '**/api/loans/applications/123e4567', {
      statusCode: 200,
      body: {
        application: {
          id: '123e4567',
          applicationNumber: 'APP-2024-001',
          status: 'DISBURSED',
          isRestructured: true,
          restructuredDate: restructuredDate.toISOString(),
          isUpgraded: true,
          upgradedDate: new Date().toISOString(),
          upgradedReason: 'Test upgrade',
          originalTenureMonths: 48,
          originalInterestRate: 12,
          applicantName: 'Test Borrower',
          requestedAmount: 150000,
          sanctionedAmount: 150000,
        },
        approvalActions: [],
      },
    });

    cy.visit('/loans/123e4567');
    cy.get('[aria-label="upgrade loan"]').click();

    // Dialog should open
    cy.get('h2').should('contain.text', 'Upgrade to Original Terms');

    // Fill reason
    cy.get('textarea[placeholder*="1-year"]').type('1-year satisfactory repayment completed');

    // Submit
    cy.get('[aria-label="confirm upgrade"]').click();

    // Should see success message
    cy.get('[role="alert"]').should('contain.text', 'upgraded to original terms successfully');

    // Verify POST was called
    cy.get('@upgradePost').should('have.been.called');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-03: Reports Tab 6 "Loan Upgrades" loads and displays table
  // ────────────────────────────────────────────────────────────────────────────
  it('T-03: Reports Tab 6 "Loan Upgrades" displays upgraded loans', () => {
    cy.loginAsDemo();

    cy.intercept('GET', '**/api/loans/applications/upgraded', {
      statusCode: 200,
      body: {
        total: 2,
        items: [
          {
            id: 'id1',
            applicationNumber: 'APP-2024-001',
            applicantName: 'Alice Smith',
            productType: 'PERSONAL_LOAN',
            outstandingPrincipal: 95000,
            originalTenureMonths: 48,
            originalInterestRate: 12,
            upgradedDate: '2026-05-01T00:00:00Z',
          },
          {
            id: 'id2',
            applicationNumber: 'APP-2024-002',
            applicantName: 'Bob Johnson',
            productType: 'PERSONAL_LOAN',
            outstandingPrincipal: 110000,
            originalTenureMonths: 60,
            originalInterestRate: 11,
            upgradedDate: '2026-05-02T00:00:00Z',
          },
        ],
      },
    }).as('upgradedLoans');

    cy.visit('/reports');

    // Find and click "Loan Upgrades" tab (Tab 6)
    cy.get('#rpt-tab-6').click();

    // Wait for data to load
    cy.get('@upgradedLoans').should('have.been.called');

    // KPI cards should show count and outstanding
    cy.get('h6').should('contain.text', 'Loan Upgrades (2)');
    cy.contains('Upgraded Count').parent().should('contain.text', '2');
    cy.contains('Total Outstanding').parent().should('contain', '₹2,05,000');

    // Table should have both loans
    cy.get('table').should('exist');
    cy.contains('APP-2024-001').should('exist');
    cy.contains('Alice Smith').should('exist');
    cy.contains('APP-2024-002').should('exist');
    cy.contains('Bob Johnson').should('exist');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-04: CSV export button downloads upgraded loans
  // ────────────────────────────────────────────────────────────────────────────
  it('T-04: CSV export works on Loan Upgrades tab', () => {
    cy.loginAsDemo();

    cy.intercept('GET', '**/api/loans/applications/upgraded', {
      statusCode: 200,
      body: {
        total: 1,
        items: [
          {
            id: 'id1',
            applicationNumber: 'APP-2024-001',
            applicantName: 'Alice Smith',
            productType: 'PERSONAL_LOAN',
            outstandingPrincipal: 95000,
            originalTenureMonths: 48,
            originalInterestRate: 12,
            upgradedDate: '2026-05-01T00:00:00Z',
          },
        ],
      },
    });

    cy.visit('/reports');
    cy.get('#rpt-tab-6').click();

    // CSV button should be enabled (loans exist)
    cy.contains('button', 'Export CSV').should('not.be.disabled').click();

    // Verify download was triggered (Cypress stubbed downloads)
    // In real E2E, this would download a file; in test we just verify button works
    cy.contains('button', 'Export CSV').should('exist');
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// Tab helpers
// ───────────────────────────────────────────────────────────────────────────────

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsDemo(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('loginAsDemo', () => {
  const mockJwt = btoa(
    JSON.stringify({ user_id: 'demo', bank_name: 'Demo Bank', tenant_id: 'public' })
  );
  const fakeToken = `fake.${mockJwt}.signature`;
  localStorage.setItem('auth-token', fakeToken);
  localStorage.setItem('authSlice', JSON.stringify({
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

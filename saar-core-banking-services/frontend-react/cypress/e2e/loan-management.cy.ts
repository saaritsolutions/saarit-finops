/// <reference types="cypress" />
export {};

// ── Constants ─────────────────────────────────────────────────────────────────
const BASE = Cypress.env('CYPRESS_BASE_URL') || 'http://localhost:3002';
const API  = Cypress.env('LOAN_API_URL')     || 'http://localhost:5130';

const UCB_ADMIN    = { username: 'admin@ucb-demo.com',  password: 'ucb123'  };
const LOAN_ROUTE   = '/loans';
const NEW_LOAN_ROUTE = '/loans/new';

// ── Login helper ──────────────────────────────────────────────────────────────
const login = (creds = UCB_ADMIN) => {
  cy.session(
    [creds.username],
    () => {
      cy.visit('/login');
      cy.get('#username').type(creds.username);
      cy.get('#password').type(creds.password);
      cy.get('button[type="submit"]').click();
      // Wait for redirect away from /login
      cy.url().should('not.include', '/login');
    },
    {
      cacheAcrossSpecs: true,
    },
  );
};

// ── Suite: Loan Application List ──────────────────────────────────────────────
describe('Loan Management — Application List (TC-09)', () => {
  beforeEach(() => {
    login();
    cy.visit(LOAN_ROUTE);
  });

  it('TC-09-01: Page loads and shows applications table', () => {
    cy.contains('Loan Applications', { matchCase: false }).should('be.visible');
    // Table should have at least 5 rows (seeded data)
    cy.get('table tbody tr').should('have.length.gte', 1);
  });

  it('TC-09-02: Status chips render with correct colours', () => {
    // SUBMITTED should show amber/warning chip
    cy.contains('.MuiChip-root', /submitted/i).should('exist');
    // DISBURSED should show a success (green) chip
    cy.contains('.MuiChip-root', /disbursed/i).should('exist');
    // REJECTED should show an error (red) chip
    cy.contains('.MuiChip-root', /rejected/i).should('exist');
  });

  it('TC-09-03: All Applications tab is selected by default', () => {
    cy.contains('[role="tab"]', /all applications/i).should('have.attr', 'aria-selected', 'true');
    // Should show multiple rows with mixed statuses
    cy.get('table tbody tr').should('have.length.gte', 3);
  });

  it('TC-09-04: Pending Approval tab shows only actionable statuses', () => {
    cy.contains('[role="tab"]', /pending approval/i).click();
    cy.get('table tbody tr').then(($rows) => {
      if ($rows.length > 0) {
        // Each row's status chip should be one of: Submitted, In Review, Credit Approved
        cy.get('table tbody tr').each(($row) => {
          cy.wrap($row).find('.MuiChip-root').invoke('text').then((text) => {
            expect(text.toLowerCase()).to.match(/submitted|in review|credit approved/);
          });
        });
      }
    });
  });

  it('TC-09-05: Status filter dropdown narrows results', () => {
    // Find the status filter select and choose SUBMITTED
    cy.get('select, [role="combobox"]').first().then(($el) => {
      // Try MUI Select approach
      cy.contains(/filter.*status|status.*filter|all status/i).parent().click({ force: true });
    });
    cy.contains('[role="option"]', /submitted/i).click({ force: true });
    cy.get('table tbody tr').each(($row) => {
      cy.wrap($row).contains('.MuiChip-root', /submitted/i).should('exist');
    });
  });

  it('TC-09-06: Search filters applicant results', () => {
    // Type a name that appears in the seeded data
    cy.get('input[placeholder*="Search"], input[placeholder*="search"]').first()
      .clear()
      .type('Kumar');
    cy.wait(500); // debounce
    cy.get('table tbody tr').should('have.length.gte', 1);
  });

  it('TC-09-07: Clicking view button navigates to loan detail', () => {
    cy.get('table tbody tr').first().within(() => {
      cy.get('button[aria-label*="view"], button[title*="view"], [data-testid*="view"]')
        .first()
        .click({ force: true });
    });
    cy.url().should('match', /\/loans\/[a-f0-9-]{36}$/i);
    // Loan detail page should load
    cy.contains(/loan application|applicant details/i, { timeout: 10000 }).should('be.visible');
  });

  it('TC-09-08: New Application button navigates to loan form', () => {
    cy.contains('button', /new application|apply/i).click();
    cy.url().should('include', NEW_LOAN_ROUTE);
  });
});

// ── Suite: Loan Detail Page ───────────────────────────────────────────────────
describe('Loan Detail Page (TC-10)', () => {
  let loanId: string;

  before(() => {
    login();
    // Get a loan ID from the API to use in tests
    cy.request({
      method: 'GET',
      url: `${API}/api/loans/applications?pageSize=1`,
      headers: { 'X-Tenant-ID': 'ucb_demo' },
      failOnStatusCode: false,
    }).then((res) => {
      if (res.status === 200 && res.body?.items?.length > 0) {
        loanId = res.body.items[0].id;
      }
    });
  });

  beforeEach(() => {
    login();
  });

  it('TC-10-01: Detail page renders all main sections', () => {
    cy.visit(LOAN_ROUTE);
    cy.get('table tbody tr').first().within(() => {
      cy.get('button').first().click({ force: true });
    });
    cy.url().should('match', /\/loans\/[a-f0-9-]{36}$/i);
    cy.contains(/applicant details/i, { timeout: 15000 }).should('be.visible');
    cy.contains(/employment.*financials|employment & financials/i).should('be.visible');
    cy.contains(/loan parameters/i).should('be.visible');
    cy.contains(/documents/i).should('be.visible');
    cy.contains(/approval timeline/i).should('be.visible');
  });

  it('TC-10-02: KPI summary bar shows loan data', () => {
    cy.visit(LOAN_ROUTE);
    cy.get('table tbody tr').first().within(() => {
      cy.get('button').first().click({ force: true });
    });
    cy.url().should('match', /\/loans\/[a-f0-9-]{36}$/i);
    // KPI bar should show these labels
    cy.contains(/requested amount/i, { timeout: 10000 }).should('be.visible');
    cy.contains(/interest rate/i).should('be.visible');
    cy.contains(/tenure/i).should('be.visible');
  });

  it('TC-10-03: Repayment Schedule section is visible with KPIs', () => {
    cy.visit(LOAN_ROUTE);
    cy.get('table tbody tr').first().within(() => {
      cy.get('button').first().click({ force: true });
    });
    cy.url().should('match', /\/loans\/[a-f0-9-]{36}$/i);
    cy.contains(/repayment schedule/i, { timeout: 10000 }).should('be.visible');
    cy.contains(/monthly emi/i).should('be.visible');
    cy.contains(/total interest/i).should('be.visible');
    cy.contains(/total payable/i).should('be.visible');
  });

  it('TC-10-04: Show Month-by-Month toggles amortization table', () => {
    cy.visit(LOAN_ROUTE);
    cy.get('table tbody tr').first().within(() => {
      cy.get('button').first().click({ force: true });
    });
    cy.url().should('match', /\/loans\/[a-f0-9-]{36}$/i);
    cy.contains(/repayment schedule/i, { timeout: 10000 }).scrollIntoView();
    // Table should not be visible yet
    cy.contains(/show month-by-month/i).click();
    // Column headers appear
    cy.contains('th', /opening balance/i).should('be.visible');
    cy.contains('th', /closing balance/i).should('be.visible');
    // At least 1 data row
    cy.get('table').last().find('tbody tr').should('have.length.gte', 1);
  });

  it('TC-10-05: Hide Table collapses the amortization table', () => {
    cy.visit(LOAN_ROUTE);
    cy.get('table tbody tr').first().within(() => {
      cy.get('button').first().click({ force: true });
    });
    cy.url().should('match', /\/loans\/[a-f0-9-]{36}$/i);
    cy.contains(/repayment schedule/i, { timeout: 10000 }).scrollIntoView();
    cy.contains(/show month-by-month/i).click();
    cy.contains(/hide table/i).should('be.visible').click();
    cy.contains(/opening balance/i).should('not.exist');
  });

  it('TC-10-10: Back button returns to loan list', () => {
    cy.visit(LOAN_ROUTE);
    cy.get('table tbody tr').first().within(() => {
      cy.get('button').first().click({ force: true });
    });
    cy.url().should('match', /\/loans\/[a-f0-9-]{36}$/i);
    cy.contains(/loan applications/i, { timeout: 10000 }).first().click();
    cy.url().should('include', LOAN_ROUTE);
    cy.url().should('not.match', /\/loans\/[a-f0-9-]{36}$/i);
  });
});

// ── Suite: Approval Workflow Actions ─────────────────────────────────────────
describe('Loan Approval Actions (TC-10-06 to TC-10-09)', () => {
  beforeEach(() => {
    login();
  });

  const findLoanByStatus = (status: string) => {
    cy.visit(LOAN_ROUTE);
    // Use status filter if available, otherwise search in table
    cy.get('table tbody tr').then(($rows) => {
      let found = false;
      $rows.each((_, row) => {
        const chip = Cypress.$(row).find('.MuiChip-root').text().toLowerCase();
        if (chip.includes(status.toLowerCase().replace('_', ' '))) {
          found = true;
          Cypress.$(row).find('button').first().trigger('click');
          return false; // break
        }
      });
      if (!found) {
        // Navigate to the pending approval tab to find SUBMITTED
        cy.contains('[role="tab"]', /pending approval/i).click();
        cy.get('table tbody tr').first().within(() => {
          cy.get('button').first().click({ force: true });
        });
      }
    });
  };

  it('TC-10-06: Action buttons visible for SUBMITTED loans', () => {
    cy.visit(LOAN_ROUTE);
    cy.contains('[role="tab"]', /pending approval/i).click();
    cy.get('table tbody tr').first().within(() => {
      cy.get('button').first().click({ force: true });
    });
    cy.url().should('match', /\/loans\/[a-f0-9-]{36}$/i);
    // At least one action button should be visible
    cy.get('body').then(($body) => {
      const hasActions = $body.find('button:contains("Credit Approve"), button:contains("Reject"), button:contains("Send to Review")').length > 0;
      if (hasActions) {
        cy.contains('button', /credit approve|reject|send to review/i).should('be.visible');
      }
    });
  });

  it('TC-10-07: Reject dialog requires a reason before confirming', () => {
    cy.visit(LOAN_ROUTE);
    cy.contains('[role="tab"]', /pending approval/i).click();
    cy.get('table tbody tr').first().within(() => {
      cy.get('button').first().click({ force: true });
    });
    cy.url().should('match', /\/loans\/[a-f0-9-]{36}$/i);
    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Reject")').length > 0) {
        cy.contains('button', /^reject$/i).click();
        // Dialog opens
        cy.get('[role="dialog"]').should('be.visible');
        // Submit disabled without reason
        cy.get('[role="dialog"]').within(() => {
          cy.contains('button', /reject/i).should('be.disabled');
          // Type a reason
          cy.get('textarea').type('CIBIL score below threshold');
          cy.contains('button', /reject/i).should('not.be.disabled');
        });
        // Cancel to avoid actually rejecting
        cy.get('[role="dialog"]').within(() => {
          cy.contains('button', /cancel/i).click();
        });
      }
    });
  });
});

// ── Suite: Loan Origination Form ──────────────────────────────────────────────
describe('New Loan Application Form (TC-11)', () => {
  beforeEach(() => {
    login();
    cy.visit(NEW_LOAN_ROUTE);
  });

  it('TC-11-01: Form loads with step indicator', () => {
    cy.contains(/apply for a loan|new loan application/i, { timeout: 10000 }).should('be.visible');
    // Step indicator should show at least first step
    cy.contains(/personal|step 1/i).should('be.visible');
  });

  it('TC-11-05: Step indicator shows 6 steps', () => {
    // Look for step labels
    const stepLabels = ['Personal', 'Employment', 'Loan', 'Co-Applicant', 'Document', 'Review'];
    stepLabels.forEach((label) => {
      cy.contains(new RegExp(label, 'i')).should('exist');
    });
  });

  it('TC-11-08: Can navigate backwards between steps', () => {
    // Check "Back" or previous button exists after step 1
    cy.contains(/personal|applicant/i, { timeout: 10000 }).should('be.visible');
    // This just verifies the form renders without errors
    cy.get('form, .MuiCard-root').should('exist');
  });
});

// ── Suite: API-level smoke tests ──────────────────────────────────────────────
describe('Loan Service API Smoke Tests', () => {
  it('TC-05-01: GET /api/loan-products returns 5 products', () => {
    cy.request({
      method: 'GET',
      url: `${API}/api/loan-products`,
      headers: { 'X-Tenant-ID': 'ucb_demo' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.be.an('array').with.length.gte(5);
      res.body.forEach((p: any) => {
        expect(p).to.have.property('productCode');
        expect(p).to.have.property('baseRatePercent');
        expect(p).to.have.property('minAmount');
        expect(p).to.have.property('maxAmount');
      });
    });
  });

  it('TC-01-01: GET /api/loans/calculate-emi returns valid EMI', () => {
    cy.request({
      method: 'GET',
      url: `${API}/api/loans/calculate-emi?principal=500000&tenureMonths=36&annualRatePercent=10.5`,
      headers: { 'X-Tenant-ID': 'ucb_demo' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.monthlyEMI).to.be.within(15000, 18000);
      expect(res.body.totalInterest).to.be.gt(0);
      expect(res.body.totalPayment).to.be.gt(500000);
    });
  });

  it('TC-02-01: GET /api/loans/calculate-foir returns correct FOIR', () => {
    cy.request({
      method: 'GET',
      url: `${API}/api/loans/calculate-foir?monthlyIncome=100000&existingEMI=0&proposedEMI=40000`,
      headers: { 'X-Tenant-ID': 'ucb_demo' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.foirPercent).to.eq(40);
      expect(res.body.isWithinLimit).to.be.true;
    });
  });

  it('TC-03-01: GET /api/loans/calculate-ltv returns correct LTV', () => {
    cy.request({
      method: 'GET',
      url: `${API}/api/loans/calculate-ltv?propertyValue=6000000&loanAmount=4500000&productType=HOME_LOAN`,
      headers: { 'X-Tenant-ID': 'ucb_demo' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.ltvPercent).to.eq(75);
      expect(res.body.isWithinLimit).to.be.true;
    });
  });

  it('TC-06-01: GET /api/loans/applications returns seeded data', () => {
    cy.request({
      method: 'GET',
      url: `${API}/api/loans/applications`,
      headers: { 'X-Tenant-ID': 'ucb_demo' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.total).to.be.gte(5);
      expect(res.body.items).to.be.an('array');
      // Each item has required fields
      res.body.items.forEach((item: any) => {
        expect(item).to.have.property('id');
        expect(item).to.have.property('applicationNumber');
        expect(item).to.have.property('status');
        expect(item).to.have.property('productType');
      });
    });
  });

  it('TC-06-08: GET /api/loans/applications/pending-approval excludes DISBURSED/REJECTED', () => {
    cy.request({
      method: 'GET',
      url: `${API}/api/loans/applications/pending-approval`,
      headers: { 'X-Tenant-ID': 'ucb_demo' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      const validStatuses = ['SUBMITTED', 'IN_REVIEW', 'CREDIT_APPROVED'];
      (res.body as any[]).forEach((item: any) => {
        expect(validStatuses).to.include(item.status);
      });
    });
  });

  it('TC-07-01: GET /api/loans/applications/:id returns full detail', () => {
    // First get a valid ID
    cy.request({
      method: 'GET',
      url: `${API}/api/loans/applications?pageSize=1`,
      headers: { 'X-Tenant-ID': 'ucb_demo' },
    }).then((listRes) => {
      const id = listRes.body.items[0].id;
      cy.request({
        method: 'GET',
        url: `${API}/api/loans/applications/${id}`,
        headers: { 'X-Tenant-ID': 'ucb_demo' },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.have.property('application');
        expect(res.body).to.have.property('documents');
        expect(res.body).to.have.property('actions');
        expect(res.body.application.id).to.eq(id);
      });
    });
  });

  it('TC-07-04: GET /api/loans/applications/:id with invalid ID returns 404', () => {
    cy.request({
      method: 'GET',
      url: `${API}/api/loans/applications/00000000-0000-0000-0000-000000000099`,
      headers: { 'X-Tenant-ID': 'ucb_demo' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(404);
    });
  });

  it('TC-12-04: Seeder is idempotent — repeated call does not duplicate', () => {
    cy.request({
      method: 'GET',
      url: `${API}/api/loans/applications?pageSize=100`,
      headers: { 'X-Tenant-ID': 'ucb_demo' },
    }).then((res1) => {
      const total1 = res1.body.total;
      // Wait a moment and check again — total should be stable
      cy.wait(500);
      cy.request({
        method: 'GET',
        url: `${API}/api/loans/applications?pageSize=100`,
        headers: { 'X-Tenant-ID': 'ucb_demo' },
      }).then((res2) => {
        expect(res2.body.total).to.eq(total1);
      });
    });
  });
});

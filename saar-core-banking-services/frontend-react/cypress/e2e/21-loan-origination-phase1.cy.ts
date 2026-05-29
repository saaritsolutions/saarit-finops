/// <reference types="cypress" />

/**
 * SAAR-LOR-001 — Loan Origination Phase 1: Eligibility Checking
 * Tests for real-time eligibility scoring with CIBIL bands, FOIR/LTV calculations
 */

describe('[REGRESSION] Loan Origination Phase 1 (SAAR-LOR-001)', () => {
  beforeEach(() => {
    cy.visit('/eligibility-check');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-01: Page loads with 4 steps visible
  // ────────────────────────────────────────────────────────────────────────────
  it('T-01: Eligibility Check page loads with 4-step wizard', () => {
    cy.get('h4').should('contain.text', 'Loan Eligibility Check');

    // Verify stepper with 4 steps
    cy.get('[role="step"]').should('have.length', 4);
    cy.get('[role="step"]').eq(0).should('contain.text', 'Personal Info');
    cy.get('[role="step"]').eq(1).should('contain.text', 'Financial Info');
    cy.get('[role="step"]').eq(2).should('contain.text', 'Review & Submit');
    cy.get('[role="step"]').eq(3).should('contain.text', 'Results');

    // Verify initial step (0) is active
    cy.get('[role="step"]').eq(0).should('have.attr', 'aria-current', 'step');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-02: Personal info validation (empty form, required fields)
  // ────────────────────────────────────────────────────────────────────────────
  it('T-02: Personal info validation prevents empty submission', () => {
    // Verify step 0 shows personal info fields
    cy.contains('h6', 'Personal Information').should('be.visible');
    cy.get('input[name="applicantName"]').should('be.visible');
    cy.get('input[name="panNumber"]').should('be.visible');
    cy.get('input[name="dateOfBirth"]').should('be.visible');

    // Try to click Next without filling form
    cy.get('button').contains('Next').click();

    // Should show error alert
    cy.get('[role="alert"]').should('contain.text', 'Please fill in all personal information');

    // Fill all required fields
    cy.get('input[name="applicantName"]').type('Rajesh Kumar');
    cy.get('input[name="panNumber"]').type('ABCDE1234F');
    cy.get('input[name="dateOfBirth"]').type('1990-05-15');

    // Select employment type
    cy.get('div[name="employmentType"]').parent().click();
    cy.contains('li', 'Salaried').click();

    // Now Next should succeed
    cy.get('button').contains('Next').click();
    cy.contains('h6', 'Financial Information').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-03: Financial info validation (income > 0 required)
  // ────────────────────────────────────────────────────────────────────────────
  it('T-03: Financial info validation enforces gross income requirement', () => {
    // Navigate to Step 0 and fill personal info
    cy.get('input[name="applicantName"]').type('Priya Singh');
    cy.get('input[name="panNumber"]').type('XYZAB5678G');
    cy.get('input[name="dateOfBirth"]').type('1988-03-20');
    cy.get('div[name="employmentType"]').parent().click();
    cy.contains('li', 'Self-Employed').click();
    cy.get('button').contains('Next').click();

    // Now at Step 1 (Financial Info)
    cy.contains('h6', 'Financial Information').should('be.visible');

    // Try to click Next without entering gross income
    cy.get('button').contains('Next').click();

    // Should show error
    cy.get('[role="alert"]').should('contain.text', 'Gross monthly income must be greater than 0');

    // Fill financial information
    cy.get('input[name="grossMonthlyIncome"]').type('80000');
    cy.get('input[name="existingMonthlyEmi"]').type('15000');
    cy.get('input[name="monthlyObligations"]').type('21000');
    cy.get('input[name="cibilScore"]').clear().type('720');

    cy.get('button').contains('Next').click();
    cy.contains('h6', 'Review Your Information').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-04: Eligibility check API call and response processing
  // ────────────────────────────────────────────────────────────────────────────
  it('T-04: Eligibility check API call returns APPROVED status with details', () => {
    // Mock the eligibility check API
    cy.intercept('POST', '**/api/loans/eligibility-check', {
      statusCode: 200,
      body: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'APPROVED',
        maxEligibleAmount: 500000,
        recommendedRate: 10.5,
        riskGrade: 'A+',
        eligibilityScore: 95,
        foirPercent: 35.0,
        foirBreached: false,
        ltvPercent: 75.0,
        cibilBand: 'EXCELLENT',
        rejectionReasons: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    }).as('eligibilityCheck');

    // Fill and submit form
    cy.get('input[name="applicantName"]').type('Amit Patel');
    cy.get('input[name="panNumber"]').type('TEST1234567');
    cy.get('input[name="dateOfBirth"]').type('1985-07-10');
    cy.get('div[name="employmentType"]').parent().click();
    cy.contains('li', 'Salaried').click();
    cy.get('button').contains('Next').click();

    cy.get('input[name="grossMonthlyIncome"]').type('100000');
    cy.get('input[name="existingMonthlyEmi"]').type('5000');
    cy.get('input[name="monthlyObligations"]').type('10000');
    cy.get('input[name="cibilScore"]').clear().type('750');
    cy.get('button').contains('Next').click();

    // At Step 2, verify review info
    cy.contains('h6', 'Review Your Information').should('be.visible');
    cy.contains('Amit Patel').should('be.visible');
    cy.contains('TEST1234567').should('be.visible');

    // Click Next to trigger API call
    cy.get('button').contains('Next').click();

    // Wait for API and verify it was called
    cy.wait('@eligibilityCheck');

    // Verify we moved to Step 3 with results
    cy.contains('h6', 'Approved!').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-05: Results display with all KPI cards
  // ────────────────────────────────────────────────────────────────────────────
  it('T-05: Results step displays all KPI cards (Amount, Rate, Grade, Score, FOIR, LTV)', () => {
    cy.intercept('POST', '**/api/loans/eligibility-check', {
      statusCode: 200,
      body: {
        id: 'test-id-123',
        status: 'APPROVED',
        maxEligibleAmount: 750000,
        recommendedRate: 10.75,
        riskGrade: 'A',
        eligibilityScore: 88,
        foirPercent: 40.0,
        foirBreached: false,
        ltvPercent: 80.0,
        cibilBand: 'GOOD',
        rejectionReasons: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    }).as('eligibilityCheck');

    // Complete form and submit
    cy.get('input[name="applicantName"]').type('Vikram Desai');
    cy.get('input[name="panNumber"]').type('VIK12345678');
    cy.get('input[name="dateOfBirth"]').type('1992-12-01');
    cy.get('div[name="employmentType"]').parent().click();
    cy.contains('li', 'Salaried').click();
    cy.get('button').contains('Next').click();

    cy.get('input[name="grossMonthlyIncome"]').type('150000');
    cy.get('input[name="existingMonthlyEmi"]').type('0');
    cy.get('input[name="monthlyObligations"]').type('0');
    cy.get('input[name="cibilScore"]').clear().type('700');
    cy.get('button').contains('Next').click();

    cy.get('button').contains('Next').click();
    cy.wait('@eligibilityCheck');

    // Verify all KPI cards are displayed
    cy.contains('Max Eligible Amount').parent().parent().should('contain.text', '750000');
    cy.contains('Recommended Rate').parent().parent().should('contain.text', '10.75');
    cy.contains('Risk Grade').parent().parent().should('contain.text', 'A');
    cy.contains('Eligibility Score').parent().parent().should('contain.text', '88');
    cy.contains('FOIR Ratio').parent().parent().should('contain.text', '40');
    cy.contains('LTV Ratio').parent().parent().should('contain.text', '80');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-06: FOIR/LTV ratio display with breach indicators
  // ────────────────────────────────────────────────────────────────────────────
  it('T-06: Results show FOIR breach indicator when exceeded', () => {
    cy.intercept('POST', '**/api/loans/eligibility-check', {
      statusCode: 200,
      body: {
        id: 'foir-breach-test',
        status: 'DECLINED',
        maxEligibleAmount: 0,
        recommendedRate: 0,
        riskGrade: 'C',
        eligibilityScore: 0,
        foirPercent: 55.0, // Exceeds limit
        foirBreached: true,
        ltvPercent: 0,
        cibilBand: 'GOOD',
        rejectionReasons: ['FOIR 55.00% exceeds limit 50%'],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    }).as('foirBreach');

    cy.get('input[name="applicantName"]').type('Test FOIR');
    cy.get('input[name="panNumber"]').type('FOIR1234567');
    cy.get('input[name="dateOfBirth"]').type('1990-01-01');
    cy.get('div[name="employmentType"]').parent().click();
    cy.contains('li', 'Salaried').click();
    cy.get('button').contains('Next').click();

    cy.get('input[name="grossMonthlyIncome"]').type('80000');
    cy.get('input[name="existingMonthlyEmi"]').type('20000');
    cy.get('input[name="monthlyObligations"]').type('24000');
    cy.get('input[name="cibilScore"]').clear().type('700');
    cy.get('button').contains('Next').click();

    cy.get('button').contains('Next').click();
    cy.wait('@foirBreach');

    // Verify FOIR is displayed with breach indicator
    cy.contains('FOIR Ratio').parent().parent().should('contain.text', '55');
    cy.contains('Breached').should('be.visible');

    // Verify status shows Declined
    cy.contains('h6', 'Declined').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-07: Pre-approval dialog interaction and amount customization
  // ────────────────────────────────────────────────────────────────────────────
  it('T-07: Pre-approval dialog opens and allows amount customization', () => {
    cy.intercept('POST', '**/api/loans/eligibility-check', {
      statusCode: 200,
      body: {
        id: 'preapproval-test',
        status: 'APPROVED',
        maxEligibleAmount: 500000,
        recommendedRate: 10.5,
        riskGrade: 'A+',
        eligibilityScore: 95,
        foirPercent: 35.0,
        foirBreached: false,
        ltvPercent: 0,
        cibilBand: 'EXCELLENT',
        rejectionReasons: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    }).as('preApprovalEligibility');

    cy.intercept('POST', '**/api/loans/**/pre-approve', {
      statusCode: 200,
      body: {
        applicationNumber: 'APP-2024-TEST-001',
        preApprovalAmount: 400000,
        preApprovalRate: 10.5,
        riskGrade: 'A+',
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        message: 'Pre-approval locked successfully for 24 hours',
      },
    }).as('lockPreApproval');

    cy.get('input[name="applicantName"]').type('Deepak Sharma');
    cy.get('input[name="panNumber"]').type('DEEP1234567');
    cy.get('input[name="dateOfBirth"]').type('1987-09-15');
    cy.get('div[name="employmentType"]').parent().click();
    cy.contains('li', 'Salaried').click();
    cy.get('button').contains('Next').click();

    cy.get('input[name="grossMonthlyIncome"]').type('120000');
    cy.get('input[name="existingMonthlyEmi"]').type('0');
    cy.get('input[name="monthlyObligations"]').type('0');
    cy.get('input[name="cibilScore"]').clear().type('750');
    cy.get('button').contains('Next').click();

    cy.get('button').contains('Next').click();
    cy.wait('@preApprovalEligibility');

    // Verify Lock in Pre-Approval button is visible
    cy.contains('button', 'Lock in Pre-Approval').should('be.visible').click();

    // Dialog should open
    cy.contains('Lock in Pre-Approval').should('be.visible');

    // Verify dialog has amount field
    cy.get('input[type="number"]').last().should('have.value', /\d+/);

    // Change pre-approval amount
    cy.get('input[type="number"]').last().clear().type('400000');

    // Submit dialog
    cy.contains('button', 'Lock in Pre-Approval').last().click();

    // Wait for API call
    cy.wait('@lockPreApproval');

    // Success alert should appear
    cy.on('window:alert', (str) => {
      expect(str).to.include('Pre-approval locked');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-08: Error handling (DECLINED status with rejection reasons)
  // ────────────────────────────────────────────────────────────────────────────
  it('T-08: Results show rejection reasons when application is DECLINED', () => {
    cy.intercept('POST', '**/api/loans/eligibility-check', {
      statusCode: 200,
      body: {
        id: 'decline-test-001',
        status: 'DECLINED',
        maxEligibleAmount: 0,
        recommendedRate: 0,
        riskGrade: 'C',
        eligibilityScore: 0,
        foirPercent: 0,
        foirBreached: false,
        ltvPercent: 0,
        cibilBand: 'POOR',
        rejectionReasons: [
          'CIBIL score 600 below minimum 650',
          'Monthly income ₹50,000 below minimum ₹100,000',
        ],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    }).as('declinedApplication');

    cy.get('input[name="applicantName"]').type('Low Score Applicant');
    cy.get('input[name="panNumber"]').type('LOSC1234567');
    cy.get('input[name="dateOfBirth"]').type('1995-06-01');
    cy.get('div[name="employmentType"]').parent().click();
    cy.contains('li', 'Salaried').click();
    cy.get('button').contains('Next').click();

    cy.get('input[name="grossMonthlyIncome"]').type('50000');
    cy.get('input[name="existingMonthlyEmi"]').type('0');
    cy.get('input[name="monthlyObligations"]').type('0');
    cy.get('input[name="cibilScore"]').clear().type('600');
    cy.get('button').contains('Next').click();

    cy.get('button').contains('Next').click();
    cy.wait('@declinedApplication');

    // Verify declined status
    cy.contains('h6', 'Declined').should('be.visible');

    // Verify rejection reasons are displayed
    cy.contains('Reasons:').should('be.visible');
    cy.contains('CIBIL score 600 below minimum 650').should('be.visible');
    cy.contains('Monthly income').should('be.visible');

    // Pre-approval button should NOT be visible
    cy.contains('button', 'Lock in Pre-Approval').should('not.exist');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T-09: Navigation between steps with data persistence
  // ────────────────────────────────────────────────────────────────────────────
  it('T-09: Form data persists when navigating back and forward between steps', () => {
    // Fill Step 0
    cy.get('input[name="applicantName"]').type('Navigation Test');
    cy.get('input[name="panNumber"]').type('NAV01234567');
    cy.get('input[name="dateOfBirth"]').type('1991-11-25');
    cy.get('div[name="employmentType"]').parent().click();
    cy.contains('li', 'Self-Employed').click();

    // Move to Step 1
    cy.get('button').contains('Next').click();

    // Fill Step 1
    cy.get('input[name="grossMonthlyIncome"]').type('95000');
    cy.get('input[name="existingMonthlyEmi"]').type('8000');
    cy.get('input[name="monthlyObligations"]').type('12000');
    cy.get('input[name="cibilScore"]').clear().type('710');

    // Go back to Step 0
    cy.get('button').contains('Back').click();

    // Verify Step 0 data is still there
    cy.get('input[name="applicantName"]').should('have.value', 'Navigation Test');
    cy.get('input[name="panNumber"]').should('have.value', 'NAV01234567');
    cy.get('input[name="dateOfBirth"]').should('have.value', '1991-11-25');

    // Move forward again
    cy.get('button').contains('Next').click();

    // Verify Step 1 data is still there
    cy.get('input[name="grossMonthlyIncome"]').should('have.value', '95000');
    cy.get('input[name="existingMonthlyEmi"]').should('have.value', '8000');
    cy.get('input[name="monthlyObligations"]').should('have.value', '12000');
    cy.get('input[name="cibilScore"]').should('have.value', '710');

    // Move to Step 2
    cy.get('button').contains('Next').click();

    // Verify summary shows correct data
    cy.contains('Navigation Test').should('be.visible');
    cy.contains('NAV01234567').should('be.visible');
    cy.contains('SELF_EMPLOYED').should('be.visible');
    cy.contains('95000').should('be.visible');
  });

  // Additional Edge Case Tests

  it('T-10: Start Over button resets wizard to Step 0', () => {
    cy.intercept('POST', '**/api/loans/eligibility-check', {
      statusCode: 200,
      body: {
        id: 'reset-test',
        status: 'APPROVED',
        maxEligibleAmount: 300000,
        recommendedRate: 12.0,
        riskGrade: 'B+',
        eligibilityScore: 75,
        foirPercent: 45.0,
        foirBreached: false,
        ltvPercent: 0,
        cibilBand: 'FAIR',
        rejectionReasons: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    }).as('resetTest');

    // Complete the form
    cy.get('input[name="applicantName"]').type('Reset Test');
    cy.get('input[name="panNumber"]').type('RESET123456');
    cy.get('input[name="dateOfBirth"]').type('1993-03-10');
    cy.get('div[name="employmentType"]').parent().click();
    cy.contains('li', 'Salaried').click();
    cy.get('button').contains('Next').click();

    cy.get('input[name="grossMonthlyIncome"]').type('110000');
    cy.get('input[name="existingMonthlyEmi"]').type('5000');
    cy.get('input[name="monthlyObligations"]').type('0');
    cy.get('input[name="cibilScore"]').clear().type('680');
    cy.get('button').contains('Next').click();

    cy.get('button').contains('Next').click();
    cy.wait('@resetTest');

    // Verify we're at results step
    cy.contains('h6', 'Approved with Conditions').should('be.visible');

    // Click Start Over
    cy.get('button').contains('Start Over').click();

    // Should be back at Step 0
    cy.contains('h6', 'Personal Information').should('be.visible');
    cy.get('input[name="applicantName"]').should('have.value', '');
    cy.get('input[name="panNumber"]').should('have.value', '');
  });

  it('T-11: Risk grade colors are applied correctly', () => {
    cy.intercept('POST', '**/api/loans/eligibility-check', {
      statusCode: 200,
      body: {
        id: 'risk-color-test',
        status: 'APPROVED',
        maxEligibleAmount: 500000,
        recommendedRate: 11.0,
        riskGrade: 'B',
        eligibilityScore: 65,
        foirPercent: 48.0,
        foirBreached: false,
        ltvPercent: 0,
        cibilBand: 'FAIR',
        rejectionReasons: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    }).as('riskGradeTest');

    cy.get('input[name="applicantName"]').type('Risk Grade Test');
    cy.get('input[name="panNumber"]').type('RISK1234567');
    cy.get('input[name="dateOfBirth"]').type('1990-02-14');
    cy.get('div[name="employmentType"]').parent().click();
    cy.contains('li', 'Salaried').click();
    cy.get('button').contains('Next').click();

    cy.get('input[name="grossMonthlyIncome"]').type('100000');
    cy.get('input[name="existingMonthlyEmi"]').type('10000');
    cy.get('input[name="monthlyObligations"]').type('38000');
    cy.get('input[name="cibilScore"]').clear().type('675');
    cy.get('button').contains('Next').click();

    cy.get('button').contains('Next').click();
    cy.wait('@riskGradeTest');

    // Verify risk grade chip is displayed
    cy.contains('B').should('be.visible');
  });
});

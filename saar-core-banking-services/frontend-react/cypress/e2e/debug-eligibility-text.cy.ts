/// <reference types="cypress" />

describe('Debug Eligibility Text Display', () => {
  const API = 'http://localhost:5004';

  const looseExpr = {
    ExpressionId: 'EXPR_LOAN_E2E_DEBUG',
    Name: 'Loan Eligibility E2E Debug',
    Description: 'Debug test for eligibility text',
    Category: 'Validation',
    ExpressionText: '(creditScore >= 750 && monthlyIncome >= 60000) ? "APPROVED" : "DECLINED"',
    ReturnType: 'string',
    ContextType: 'Loan',
    UsageType: 'Validation',
    Tags: ['eligibility', 'e2e'],
  };

  function fillLoanForm() {
    // Use the same selectors as the original test
    cy.get('[data-testid="field-loanAmount"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('500000', { force: true });
    cy.get('[data-testid="field-tenureMonths"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('24', { force: true });
    cy.get('[data-testid="field-monthlyIncome"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('65000', { force: true });
    cy.get('[data-testid="field-creditScore"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('780', { force: true });
    cy.get('body').then(($b) => {
      if ($b.find('[data-testid="field-debtToIncomeRatio"]').length) {
        cy.get('[data-testid="field-debtToIncomeRatio"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('0.25', { force: true });
      }
    });
  }

  function closeAnyBackdrop() {
    cy.get('body').then(($body) => {
      if ($body.find('.MuiBackdrop-root').length > 0) {
        cy.get('.MuiBackdrop-root').click({ force: true });
      }
    });
  }

  it('Debug: Check what text is actually displayed in eligibility result', () => {
    // Add login first
    cy.loginAsDemo();
    
    // Setup loose expression first
    cy.request({
      method: 'POST',
      url: `${API}/api/Expressions`,
      body: looseExpr,
      failOnStatusCode: false,
    }).then((res) => {
      // Allow Created or Already exists (400) as acceptable
      expect([201, 400]).to.include(res.status);
    });

    cy.visit('/loans/new');
    cy.contains('Apply for a Loan');
    fillLoanForm();
    closeAnyBackdrop();
    cy.contains('button', 'Pre-Validate').scrollIntoView().click({ force: true });
    
    // Wait for the button to show "Validating..." indicating API call started
    cy.contains('button', 'Validating...').should('be.visible');
    
    // Wait for the button to go back to "Pre-Validate" indicating API call completed
    cy.contains('button', 'Pre-Validate', { timeout: 15000 }).should('be.visible');
    
    // Check that pre-validation completes and log ALL text content
    cy.get('[data-cy="pre-validation-result"]', { timeout: 10000 }).should('be.visible');
    
    // Log the entire pre-validation result content
    cy.get('[data-cy="pre-validation-result"]').then(($el) => {
      cy.log('=== FULL PRE-VALIDATION RESULT ===');
      cy.log($el.text());
      console.log('=== FULL PRE-VALIDATION RESULT ===');
      console.log($el.text());
    });

    // Check if eligibility-result element exists and log its content
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="eligibility-result"]').length > 0) {
        cy.get('[data-cy="eligibility-result"]').then(($el) => {
          cy.log('=== ELIGIBILITY RESULT ELEMENT ===');
          cy.log($el.text());
          console.log('=== ELIGIBILITY RESULT ELEMENT ===');
          console.log($el.text());
        });
      } else {
        cy.log('No eligibility-result element found!');
        console.log('No eligibility-result element found!');
        
        // Let's see what elements do exist with data-cy attributes
        cy.get('[data-cy]').each(($el) => {
          const dataCy = $el.attr('data-cy');
          cy.log(`Found element with data-cy="${dataCy}": ${$el.text()}`);
          console.log(`Found element with data-cy="${dataCy}": ${$el.text()}`);
        });
      }
    });

    // Also check what's in the CardContent specifically
    cy.get('[data-cy="pre-validation-result"] .MuiCardContent-root').then(($content) => {
      cy.log('=== CARD CONTENT ONLY ===');
      cy.log($content.text());
      console.log('=== CARD CONTENT ONLY ===');
      console.log($content.text());
    });
  });
});
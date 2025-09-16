describe('Debug Pre-validation', () => {
  it('should show pre-validation result', () => {
    cy.visit('/loans/new');
    cy.contains('Apply for a Loan');
    
    // Close any backdrop/modal that might be open
    cy.get('body').then(($body) => {
      if ($body.find('.MuiBackdrop-root').length > 0) {
        cy.get('.MuiBackdrop-root').click({ multiple: true, force: true });
      }
    });
    
    // Wait a bit and try to dismiss any overlays
    cy.wait(1000);
    cy.get('body').click();
    
    // Fill form with simple values using force: true
    cy.get('[data-testid="field-loanAmount"]').clear({ force: true }).type('50000', { force: true });
    cy.get('[data-testid="field-tenureMonths"]').clear({ force: true }).type('12', { force: true });
    cy.get('[data-testid="field-monthlyIncome"]').clear({ force: true }).type('15000', { force: true });
    cy.get('[data-testid="field-creditScore"]').clear({ force: true }).type('750', { force: true });
    
    // Click pre-validate
    cy.contains('button', 'Pre-Validate').click({ force: true });
    
    // Wait for result and log what we see
    cy.wait(3000);
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="pre-validation-result"]').length > 0) {
        cy.get('[data-cy="pre-validation-result"]').then(($el) => {
          console.log('Pre-validation result found:', $el.text());
          cy.log('Pre-validation result:', $el.text());
        });
      } else {
        cy.log('No pre-validation result element found');
      }
    });
    
    // Check for any error messages
    cy.get('body').then(($body) => {
      const alerts = $body.find('[role="alert"]');
      if (alerts.length > 0) {
        alerts.each((i, el) => {
          cy.log('Alert found:', Cypress.$(el).text());
        });
      }
    });
  });
});
// Cypress E2E test for customer creation (CustomerCreateComponent)

describe('Customer Creation E2E', () => {
  it('should create a customer via the UI and verify in the backend', () => {
    const timestamp = Date.now();
    cy.visit('/customer/create-generic');
    cy.get('mat-tab-group', { timeout: 10000 }).should('exist');
    cy.contains('Personal Details', { timeout: 10000 }).should('be.visible');
    cy.get('input[formcontrolname="firstName"]').should('be.visible').should('be.enabled').focus().type('{selectall}{backspace}E2E');
    cy.get('input[formcontrolname="lastName"]').should('be.visible').should('be.enabled').focus().type('{selectall}{backspace}Test');
    // Only use .invoke for dateOfBirth
    cy.get('input[formcontrolname="dateOfBirth"]').should('be.visible').should('be.enabled').focus()
      .invoke('val', '1990-01-01').trigger('input').wait(100);
    cy.get('mat-select[formcontrolname="gender"]').click();
    cy.get('mat-option').contains('Male').click();
    cy.get('mat-select[formcontrolname="customerType"]').click();
    cy.get('mat-option').contains('Individual').click();
    // --- Contact Information tab ---
    cy.contains('Contact Information').click();
    cy.get('textarea[formcontrolname="postalAddress"]').should('be.visible').should('be.enabled').focus().type('{selectall}{backspace}123 E2E St');
    cy.get('input[formcontrolname="mobile"]').should('be.visible').should('be.enabled').focus().type('{selectall}{backspace}9876543210');
    cy.get('input[formcontrolname="email"]').should('be.visible').should('be.enabled').focus().type(`{selectall}{backspace}e2e${timestamp}@example.com`);
    // Submit (from any tab)
    cy.intercept('POST', '/api/Customer').as('createCustomer');
    cy.get('button[type="submit"], button[color="primary"]').contains(/save customer/i).click();
    cy.wait('@createCustomer').then((interception) => {
      // Log the request payload to the Cypress command log
      cy.log('Payload:', JSON.stringify(interception.request.body));
      // Also print to browser console for easy copy-paste
      // eslint-disable-next-line no-console
      console.log('Customer payload:', interception.request.body);
    });
    cy.contains('Customer created successfully').should('exist');
    // Optionally, verify in backend via API (assumes /api is proxied to backend)
    cy.request('GET', 'http://localhost:5200/api/Customer').then((response) => {
      expect(response.status).to.eq(200);
      const found = response.body.find((c: any) => c.email === `e2e${timestamp}@example.com`);
      expect(found).to.not.be.undefined;
      expect(found.postalAddress).to.eq('123 E2E St');
    });
  });
});

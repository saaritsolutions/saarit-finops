// E2E test for customer creation using Cypress (or Protractor, but Cypress is recommended)
// This is a placeholder. You should run this with Cypress, not ng test.

describe('Customer Creation E2E', () => {
  it('should create a customer via the UI and verify in the backend', () => {
    // Visit the customer creation page
    cy.visit('/customer/create');
    // Fill the form
    const timestamp = Date.now();
    cy.get('input[formcontrolname="firstName"]').type('E2E');
    cy.get('input[formcontrolname="lastName"]').type('Test');
    cy.get('input[formcontrolname="email"]').type(`e2e${timestamp}@example.com`);
    cy.get('input[formcontrolname="dateOfBirth"]').type('1990-01-01');
    cy.get('input[formcontrolname="mobile"]').type('9876543210');
    cy.get('input[formcontrolname="postalAddress"]').type('123 E2E St');
    cy.get('select[formcontrolname="gender"]').select('F');
    cy.get('select[formcontrolname="customerType"]').select('Individual');
    // Submit
    cy.get('button[type="submit"]').click();
    // Check for success message
    cy.contains('Customer created successfully').should('exist');
    // Optionally, verify in backend via API
    cy.request('GET', 'http://localhost:5200/api/Customer').then((response) => {
      expect(response.status).to.eq(200);
      const found = response.body.find((c: any) => c.email === `e2e${timestamp}@example.com`);
      expect(found).to.not.be.undefined;
    });
  });
});

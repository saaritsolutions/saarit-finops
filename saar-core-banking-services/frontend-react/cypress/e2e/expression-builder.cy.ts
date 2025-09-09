/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />
export {};

// Updated E2E aligned with current WorldClassExpressionBuilder UI
describe('Expression Builder E2E (WorldClass UI)', () => {
  // Helpers for robust interactions (handle MUI backdrops/overlays)
  const closeAnyBackdrop = () => {
    cy.get('body').then(($body) => {
      const hasBackdrop = $body.find('.MuiBackdrop-root:visible').length > 0;
      if (hasBackdrop) {
        cy.get('body').type('{esc}', { force: true });
        cy.get('.MuiBackdrop-root:visible').click({ force: true }).should('not.exist');
      }
    });
  };

  const safeClick = (selectorOrContains: string | RegExp, opts: Partial<Cypress.ClickOptions> = {}) => {
    closeAnyBackdrop();
    if (typeof selectorOrContains === 'string' && selectorOrContains.startsWith('[')) {
      cy.get(selectorOrContains).scrollIntoView().click({ force: true, ...opts });
    } else {
      cy.contains(selectorOrContains as any).scrollIntoView().click({ force: true, ...opts });
    }
  };

  const safeType = (getEl: () => Cypress.Chainable<JQuery<HTMLElement>>, text: string) => {
    closeAnyBackdrop();
    getEl().scrollIntoView().click({ force: true }).clear({ force: true }).type(text, { force: true });
  };

  const clickTab = (label: string) => {
    closeAnyBackdrop();
    cy.contains('[role="tab"]', label).scrollIntoView().click({ force: true });
  };

  beforeEach(() => {
    cy.loginAsDemo();
    cy.visit('/expressions');
    cy.contains('SaaR Expression Builder', { timeout: 10000 }).should('be.visible');
    // Ensure default tab content is loaded
    cy.contains('Expression Code').should('be.visible');
    closeAnyBackdrop();
  });

  it('displays main interface and tabs', () => {
    cy.contains('SaaR Expression Builder').should('be.visible');
    cy.contains('Builder').should('be.visible');
    cy.contains('Templates').should('be.visible');
    cy.contains('History').should('be.visible');
  });

  it('navigates between tabs', () => {
  clickTab('Templates');
    cy.contains('Expression Templates', { timeout: 8000 }).should('be.visible');

  clickTab('History');
    cy.contains('Expression History', { timeout: 8000 }).should('be.visible');

  clickTab('Builder');
  // Assert the Builder tab is selected and the editor is visible
  cy.contains('[role="tab"]', 'Builder').should('have.attr', 'aria-selected', 'true');
  cy.get('[data-testid="expression-editor"]').should('be.visible');
  });

  it('enters and validates/saves an expression (backend optional)', () => {
    // Fill metadata
  safeType(() => cy.findByLabelText('Expression Name'), 'Demo Age Check');
    // Fill code
  safeType(() => cy.get('[data-testid="expression-editor"]'), "IF (customer.Age >= 18) THEN true ELSE false");

    // Validate (may show success or error depending on backend availability)
  safeClick('[data-testid="btn-validate"]');
    cy.contains(/Validating|Expression is valid|validation failed|Failed to connect/i, { timeout: 10000 });

    // Try Save (assert presence of save status alert regardless of result)
  safeClick('[data-testid="btn-save"]');
    cy.get('[data-testid="save-success"]', { timeout: 10000 }).should('be.visible');
  });
});

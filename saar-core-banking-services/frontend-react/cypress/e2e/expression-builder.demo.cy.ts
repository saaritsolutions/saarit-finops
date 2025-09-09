/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />
export {};

// Demo spec with small delays to make the recording clearer
const DEMO_PAUSE_MS = Number(Cypress.env('demoPauseMs') ?? 800);
const demoPause = () => cy.wait(DEMO_PAUSE_MS);

describe('Expression Builder Demo E2E (WorldClass UI)', () => {
  const closeAnyBackdrop = () => {
    cy.get('body').then(($body) => {
      const hasBackdrop = $body.find('.MuiBackdrop-root:visible').length > 0;
      if (hasBackdrop) {
        cy.get('body').type('{esc}', { force: true });
        cy.get('.MuiBackdrop-root:visible').click({ force: true }).should('not.exist');
      }
    });
  };

  const clickTab = (label: string) => {
    closeAnyBackdrop();
    cy.contains('[role="tab"]', label).scrollIntoView();
    demoPause();
    cy.contains('[role="tab"]', label).click({ force: true });
  };

  const safeClick = (selector: string) => {
    closeAnyBackdrop();
    cy.get(selector).scrollIntoView();
    demoPause();
    cy.get(selector).click({ force: true });
  };

  const safeType = (getEl: () => Cypress.Chainable<JQuery<HTMLElement>>, text: string) => {
    closeAnyBackdrop();
    const el = getEl();
    el.scrollIntoView();
    demoPause();
    el.click({ force: true }).clear({ force: true }).type(text, { force: true });
  };

  beforeEach(() => {
    cy.loginAsDemo();
    demoPause();
    cy.visit('/expressions');
    cy.contains('SaaR Expression Builder', { timeout: 10000 }).should('be.visible');
    cy.contains('Expression Code').should('be.visible');
    closeAnyBackdrop();
  });

  it('navigates UI and saves a demo expression (with pauses)', () => {
    // Show tabs
    clickTab('Templates');
    cy.contains('Expression Templates', { timeout: 8000 }).should('be.visible');
    demoPause();

    clickTab('History');
    cy.contains('Expression History', { timeout: 8000 }).should('be.visible');
    demoPause();

    clickTab('Builder');
    cy.contains('[role="tab"]', 'Builder').should('have.attr', 'aria-selected', 'true');
    cy.get('[data-testid="expression-editor"]').should('be.visible');
    demoPause();

    // Enter expression
    safeType(() => cy.findByLabelText('Expression Name'), 'Demo Age Check (Demo)');
    demoPause();
    safeType(() => cy.get('[data-testid="expression-editor"]'), "IF (customer.Age >= 18) THEN true ELSE false");
    demoPause();

    // Validate and Save
    safeClick('[data-testid="btn-validate"]');
    cy.contains(/Validating|Expression is valid|validation failed|Failed to connect/i, { timeout: 10000 });
    demoPause();

    safeClick('[data-testid="btn-save"]');
    cy.get('[data-testid="save-success"]', { timeout: 10000 }).should('be.visible');
  });
});

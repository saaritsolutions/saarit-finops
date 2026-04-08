/// <reference types="cypress" />
export {};

/**
 * Smoke check — run this FIRST to verify Cypress can reach the app.
 * If this passes, the full loan-workflow-ui.cy.ts tests should work too.
 */
describe('Smoke Check', () => {
  it('loads the React app root', () => {
    cy.visit('/');
    cy.get('body').should('be.visible');
    cy.title().should('not.be.empty');
    cy.log('✅ React app loaded at localhost:3002');
  });

  it('loads /expressions/simple route', () => {
    cy.visit('/expressions/simple');
    cy.get('body').should('be.visible');
    cy.contains('Expression', { timeout: 15000 }).should('be.visible');
    cy.log('✅ SimpleExpressionBuilder route loaded');
  });

  it('ExpressionBuilderService API is reachable', () => {
    cy.request('http://localhost:5004/api/expressions?page=1&pageSize=1')
      .its('status').should('eq', 200);
    cy.log('✅ ExpressionBuilderService up on :5004');
  });
});

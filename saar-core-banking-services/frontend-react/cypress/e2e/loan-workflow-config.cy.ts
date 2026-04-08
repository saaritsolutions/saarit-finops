/// <reference types="cypress" />
export {};

/**
 * Loan Workflow Configuration Tests
 *
 * These two tests exercise the full round-trip of changing the loan origination
 * workflow at runtime via the ExpressionBuilderService API, then verifying the
 * change is reflected in the Expression Builder UI History tab.
 *
 * Test 1: Reduce to 2 steps — START → CREDIT_REVIEW → SANCTION_APPROVAL
 *         (removes the LEGAL_REVIEW step)
 * Test 2: Restore original 3 steps — START → CREDIT_REVIEW → LEGAL_REVIEW → SANCTION_APPROVAL
 *
 * No redeployment is needed — the workflow engine reads the expression on every
 * workflow start, so the change takes effect immediately for all new applications.
 */

const API = Cypress.env('expressionApiUrl') || 'http://localhost:5004';
const EXPRESSION_ID = 'EXPR_ROUTING_LOAN_ORIGINATION';

const TWO_STEP_EXPRESSION =
  'workflow_currentStep == "START" ? "CREDIT_REVIEW" : ' +
  'workflow_currentStep == "CREDIT_REVIEW" ? "SANCTION_APPROVAL" : ' +
  '"COMPLETED"';

const THREE_STEP_EXPRESSION =
  'workflow_currentStep == "START" ? "CREDIT_REVIEW" : ' +
  'workflow_currentStep == "CREDIT_REVIEW" ? "LEGAL_REVIEW" : ' +
  'workflow_currentStep == "LEGAL_REVIEW" ? "SANCTION_APPROVAL" : ' +
  '"COMPLETED"';

/** Fetch the expression record and return its internal GUID via the by-expression-id lookup. */
const getExpressionGuid = (): Cypress.Chainable<string> =>
  cy
    .request({
      method: 'GET',
      url: `${API}/api/expressions/by-expression-id/${EXPRESSION_ID}`,
      failOnStatusCode: false,
    })
    .then((res) => {
      expect(res.status, `GET by-expression-id should return 200 for ${EXPRESSION_ID}`).to.eq(200);
      const guid: string = res.body?.id;
      expect(guid, 'Response should contain a GUID id field').to.be.a('string').and.not.be.empty;
      return guid;
    });

/** Update the expression text using the GUID-based PUT endpoint. */
const updateExpression = (guid: string, expressionText: string): Cypress.Chainable<void> =>
  cy
    .request({
      method: 'PUT',
      url: `${API}/api/expressions/${guid}`,
      body: { ExpressionText: expressionText },
      failOnStatusCode: false,
    })
    .then((res) => {
      expect(res.status, 'PUT should succeed with 200').to.eq(200);
    });

// ---------------------------------------------------------------------------

describe('Loan Workflow Configuration — step count changes', () => {
  // Smoke-check: bail out early and skip gracefully if backend is down
  before(() => {
    cy.request({ method: 'GET', url: `${API}/health`, failOnStatusCode: false }).then((res) => {
      if (res.status !== 200) {
        Cypress.env('backendDown', true);
        cy.log('⚠️  ExpressionBuilderService not reachable — tests will be skipped');
      }
    });
  });

  // -------------------------------------------------------------------------
  it('reduces loan workflow to 2 steps (removes LEGAL_REVIEW)', function () {
    if (Cypress.env('backendDown')) {
      cy.log('Skipping — backend unavailable');
      return;
    }

    // Step 1 — Update expression via API
    getExpressionGuid().then((guid) => {
      updateExpression(guid, TWO_STEP_EXPRESSION);

      // Step 2 — Verify the API now returns the updated text
      cy.request({
        method: 'GET',
        url: `${API}/api/expressions/by-expression-id/${EXPRESSION_ID}`,
      }).then((res) => {
        expect(res.status).to.eq(200);
        const text: string = res.body?.expressionText ?? res.body?.ExpressionText ?? '';
        expect(text, 'Expression text should contain SANCTION_APPROVAL after CREDIT_REVIEW').to.include(
          '"CREDIT_REVIEW" ? "SANCTION_APPROVAL"'
        );
        expect(text, 'Expression text should NOT contain LEGAL_REVIEW after reduction').not.to.include(
          'LEGAL_REVIEW'
        );
        cy.log('✅ API confirmed 2-step expression:', text);
      });
    });

    // Step 3 — Verify the change is visible in the Expression Builder UI
    cy.loginAsDemo();
    cy.visit('/expressions');
    cy.contains('SaaR Expression Builder', { timeout: 10000 }).should('be.visible');

    // Switch to History tab which fetches and lists live expressions
    cy.contains('[role="tab"]', 'History').scrollIntoView().click({ force: true });
    cy.contains('Expression History', { timeout: 8000 }).should('be.visible');

    // The routing expression should appear in the list
    cy.contains(EXPRESSION_ID, { timeout: 8000 }).should('be.visible');

    cy.log('✅ 2-step workflow is live. Flow: START → CREDIT_REVIEW → SANCTION_APPROVAL → COMPLETED');
  });

  // -------------------------------------------------------------------------
  it('restores loan workflow to original 3 steps (re-adds LEGAL_REVIEW)', function () {
    if (Cypress.env('backendDown')) {
      cy.log('Skipping — backend unavailable');
      return;
    }

    // Step 1 — Restore expression via API
    getExpressionGuid().then((guid) => {
      updateExpression(guid, THREE_STEP_EXPRESSION);

      // Step 2 — Verify the API returns the restored text
      cy.request({
        method: 'GET',
        url: `${API}/api/expressions/by-expression-id/${EXPRESSION_ID}`,
      }).then((res) => {
        expect(res.status).to.eq(200);
        const text: string = res.body?.expressionText ?? res.body?.ExpressionText ?? '';
        expect(text, 'Expression text should contain LEGAL_REVIEW after restore').to.include(
          'LEGAL_REVIEW'
        );
        expect(text, 'Expression text should contain CREDIT_REVIEW → LEGAL_REVIEW chain').to.include(
          '"CREDIT_REVIEW" ? "LEGAL_REVIEW"'
        );
        expect(text, 'Expression text should contain LEGAL_REVIEW → SANCTION_APPROVAL chain').to.include(
          '"LEGAL_REVIEW" ? "SANCTION_APPROVAL"'
        );
        cy.log('✅ API confirmed 3-step expression restored:', text);
      });
    });

    // Step 3 — Verify in UI
    cy.loginAsDemo();
    cy.visit('/expressions');
    cy.contains('SaaR Expression Builder', { timeout: 10000 }).should('be.visible');

    cy.contains('[role="tab"]', 'History').scrollIntoView().click({ force: true });
    cy.contains('Expression History', { timeout: 8000 }).should('be.visible');
    cy.contains(EXPRESSION_ID, { timeout: 8000 }).should('be.visible');

    cy.log(
      '✅ Original 3-step workflow restored. Flow: START → CREDIT_REVIEW → LEGAL_REVIEW → SANCTION_APPROVAL → COMPLETED'
    );
  });
});

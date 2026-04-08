/// <reference types="cypress" />
export {};

/**
 * Loan Workflow Configuration — UI Tests (SimpleExpressionBuilder)
 *
 * Route: /expressions/simple
 *
 * These tests drive the actual browser UI:
 *   1. Load the expression list
 *   2. Click Edit on EXPR_ROUTING_LOAN_ORIGINATION
 *   3. Replace the expression text in the form
 *   4. Click "Update Expression"
 *   5. Verify the list re-shows the updated expression
 *
 * Test 1: Reduce to 2 steps  — removes LEGAL_REVIEW
 * Test 2: Restore 3 steps    — re-adds LEGAL_REVIEW
 *
 * Prerequisites:
 *   - React frontend running on http://localhost:3002
 *   - ExpressionBuilderService running on http://localhost:5004
 */

const EXPRESSION_NAME = 'Loan Origination Workflow Step Routing';

const TWO_STEP =
  'workflow_currentStep == "START" ? "CREDIT_REVIEW" : ' +
  'workflow_currentStep == "CREDIT_REVIEW" ? "SANCTION_APPROVAL" : ' +
  '"COMPLETED"';

const THREE_STEP =
  'workflow_currentStep == "START" ? "CREDIT_REVIEW" : ' +
  'workflow_currentStep == "CREDIT_REVIEW" ? "LEGAL_REVIEW" : ' +
  'workflow_currentStep == "LEGAL_REVIEW" ? "SANCTION_APPROVAL" : ' +
  '"COMPLETED"';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Open the Simple Expression Builder page and wait for the list to load. */
const openExpressionList = () => {
  cy.visit('/expressions/simple');
  // Wait for either a table row OR an "No expressions" message
  cy.get('table, [role="alert"]', { timeout: 15000 }).should('exist');
};

/**
 * Find the row for our expression and click its Edit button.
 * Switches the component to Tab 1 (Create/Edit) with the form populated.
 */
const clickEditOnRow = () => {
  cy.contains('td', EXPRESSION_NAME, { timeout: 10000 })
    .closest('tr')
    .find('button')
    .contains('Edit')
    .click({ force: true });

  // Form should now be visible (Tab 1 activated)
  cy.contains('Create/Edit Expression', { timeout: 8000 }).should('be.visible');
};

/**
 * Clear the Expression Logic textarea and type new text.
 * Targets the only monospace textarea on the form (the one with the code placeholder).
 */
const setExpressionText = (text: string) => {
  cy.get('textarea[placeholder*="IF(customer.creditScore"]')
    .scrollIntoView()
    .click({ force: true })
    .clear({ force: true })
    .type(text, { force: true, delay: 0 });
};

/** Stub window.alert, click Update Expression, and verify the alert text. */
const saveAndVerify = (expectedAlertFragment: string) => {
  cy.window().then((win) => {
    cy.stub(win, 'alert').as('alertStub');
  });

  cy.contains('button', 'Update Expression').click({ force: true });

  cy.get('@alertStub', { timeout: 15000 }).should(
    'have.been.calledWithMatch',
    new RegExp(expectedAlertFragment, 'i')
  );
};

// ── tests ────────────────────────────────────────────────────────────────────

describe('Loan Workflow Configuration — UI (SimpleExpressionBuilder)', () => {
  beforeEach(() => {
    cy.loginAsDemo();
  });

  // -------------------------------------------------------------------------
  it('reduces loan workflow to 2 steps via the UI (removes LEGAL_REVIEW)', () => {
    openExpressionList();
    clickEditOnRow();
    setExpressionText(TWO_STEP);
    saveAndVerify('updated successfully');

    // Go back to the list and confirm the API has the new text
    cy.request({
      method: 'GET',
      url: 'http://localhost:5004/api/expressions/by-expression-id/EXPR_ROUTING_LOAN_ORIGINATION',
    }).then((res) => {
      const text: string = res.body?.expressionText ?? '';
      expect(text).to.include('"CREDIT_REVIEW" ? "SANCTION_APPROVAL"');
      expect(text).not.to.include('LEGAL_REVIEW');
    });

    cy.log('✅ 2-step workflow live: START → CREDIT_REVIEW → SANCTION_APPROVAL → COMPLETED');
  });

  // -------------------------------------------------------------------------
  it('restores loan workflow to original 3 steps via the UI (re-adds LEGAL_REVIEW)', () => {
    openExpressionList();
    clickEditOnRow();
    setExpressionText(THREE_STEP);
    saveAndVerify('updated successfully');

    cy.request({
      method: 'GET',
      url: 'http://localhost:5004/api/expressions/by-expression-id/EXPR_ROUTING_LOAN_ORIGINATION',
    }).then((res) => {
      const text: string = res.body?.expressionText ?? '';
      expect(text).to.include('"CREDIT_REVIEW" ? "LEGAL_REVIEW"');
      expect(text).to.include('"LEGAL_REVIEW" ? "SANCTION_APPROVAL"');
    });

    cy.log('✅ 3-step workflow restored: START → CREDIT_REVIEW → LEGAL_REVIEW → SANCTION_APPROVAL → COMPLETED');
  });
});

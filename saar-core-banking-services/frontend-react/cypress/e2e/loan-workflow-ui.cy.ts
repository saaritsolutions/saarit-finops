/// <reference types="cypress" />
export {};

/**
 * Loan Workflow Configuration — UI Tests (SimpleExpressionBuilder)
 *
 * Route: /expressions/simple
 *
 * Test 1: Reduce to 2 steps  — removes LEGAL_REVIEW
 * Test 2: Restore 3 steps    — re-adds LEGAL_REVIEW
 *
 * Prerequisites:
 *   - React frontend on http://localhost:3002
 *   - ExpressionBuilderService on http://localhost:5004
 */

const EXPRESSION_NAME = 'Loan Origination Workflow Step Routing';
const API = 'http://localhost:5004';

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

const visitExpressionList = () => {
  cy.visit('/expressions/simple');
  cy.get('body', { timeout: 15000 }).should('be.visible');
  cy.contains('Expression', { timeout: 10000 }).should('be.visible');
};

const clickEditOnTargetRow = () => {
  cy.contains(EXPRESSION_NAME, { timeout: 10000 })
    .closest('tr')
    .within(() => {
      cy.contains('button', 'Edit').click({ force: true });
    });
  cy.contains('Create/Edit Expression', { timeout: 8000 }).should('be.visible');
};

const setExpressionLogic = (newText: string) => {
  cy.get('textarea').filter((_i, el) => {
    return (el as HTMLTextAreaElement).placeholder.includes('IF(customer.creditScore');
  }).as('exprField');

  cy.get('@exprField')
    .scrollIntoView()
    .clear({ force: true })
    .type(newText, { force: true, delay: 0 });
};

const clickUpdateAndExpectSuccess = () => {
  cy.on('window:alert', (msg: string) => {
    expect(msg).to.match(/updated successfully/i);
  });
  cy.contains('button', 'Update Expression').scrollIntoView().click({ force: true });
  cy.wait(1500);
};

const verifyApiHasText = (mustInclude: string[], mustExclude: string[] = []) => {
  cy.request(`${API}/api/expressions/by-expression-id/EXPR_ROUTING_LOAN_ORIGINATION`)
    .its('body.expressionText')
    .then((text: string) => {
      mustInclude.forEach((fragment) => expect(text).to.include(fragment));
      mustExclude.forEach((fragment) => expect(text).not.to.include(fragment));
    });
};

// ── tests ────────────────────────────────────────────────────────────────────

describe('Loan Workflow Configuration — UI (SimpleExpressionBuilder)', () => {
  before(() => {
    cy.request({ url: `${API}/api/expressions?page=1&pageSize=1`, failOnStatusCode: false })
      .then((res) => {
        if (res.status >= 400) {
          throw new Error('ExpressionBuilderService not reachable — start it on :5004');
        }
      });
  });

  beforeEach(() => {
    cy.loginAsDemo();
  });

  it('reduces loan workflow to 2 steps via UI (removes LEGAL_REVIEW)', () => {
    visitExpressionList();
    clickEditOnTargetRow();
    setExpressionLogic(TWO_STEP);
    clickUpdateAndExpectSuccess();
    verifyApiHasText(
      ['"CREDIT_REVIEW" ? "SANCTION_APPROVAL"'],
      ['LEGAL_REVIEW']
    );
    cy.log('✅ 2-step: START → CREDIT_REVIEW → SANCTION_APPROVAL → COMPLETED');
  });

  it('restores loan workflow to original 3 steps via UI (re-adds LEGAL_REVIEW)', () => {
    visitExpressionList();
    clickEditOnTargetRow();
    setExpressionLogic(THREE_STEP);
    clickUpdateAndExpectSuccess();
    verifyApiHasText([
      '"CREDIT_REVIEW" ? "LEGAL_REVIEW"',
      '"LEGAL_REVIEW" ? "SANCTION_APPROVAL"',
    ]);
    cy.log('✅ 3-step restored: START → CREDIT_REVIEW → LEGAL_REVIEW → SANCTION_APPROVAL → COMPLETED');
  });
});

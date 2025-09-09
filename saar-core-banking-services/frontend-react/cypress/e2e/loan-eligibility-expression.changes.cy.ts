/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />
export {};

// This E2E seeds eligibility expressions through the backend and verifies the UI reacts
// 1) Seed a loose rule -> Pre-Validate shows APPROVED
// 2) Update the same rule to strict -> Pre-Validate shows DECLINED with same inputs

const API = 'http://localhost:5004';

const seedExpression = (payload: any) => {
  cy.request({
    method: 'POST',
    url: `${API}/api/Expressions`,
    body: payload,
    failOnStatusCode: false,
  }).then((res) => {
  // Allow Created or Already exists (400) as acceptable
  expect([201, 400]).to.include(res.status);
  });
};

const looseExpr = {
  ExpressionId: 'EXPR_LOAN_E2E',
  Name: 'Loan Eligibility E2E',
  Description: 'Approved when creditScore >= 750 && monthlyIncome >= 60000',
  Category: 'Validation',
  ExpressionText: '(creditScore >= 750 && monthlyIncome >= 60000) ? "APPROVED" : "DECLINED"',
  ReturnType: 'string',
  ContextType: 'Loan',
  UsageType: 'Validation',
  Tags: ['eligibility', 'e2e'],
};

const strictExprText = '(creditScore >= 800 && monthlyIncome >= 100000) ? "APPROVED" : "DECLINED"';

const closeAnyBackdrop = () => {
  cy.get('body').then(($body) => {
    const hasBackdrop = $body.find('.MuiBackdrop-root:visible').length > 0;
    if (hasBackdrop) {
      cy.get('body').type('{esc}', { force: true });
      cy.get('.MuiBackdrop-root:visible').click({ force: true });
    }
  });
};

const fillLoanForm = () => {
  // Use stable testids wired earlier
  cy.get('[data-testid="field-loanAmount"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('500000', { force: true });
  cy.get('[data-testid="field-tenureMonths"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('24', { force: true });
  cy.get('[data-testid="field-monthlyIncome"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('65000', { force: true });
  cy.get('[data-testid="field-creditScore"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('780', { force: true });
  cy.get('body').then(($b) => {
    if ($b.find('[data-testid="field-debtToIncomeRatio"]').length) {
      cy.get('[data-testid="field-debtToIncomeRatio"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('0.25', { force: true });
    }
  });
};

describe('Loan Eligibility changes when expression updates', () => {
  before(() => {
    // Seed loose rule first
    seedExpression(looseExpr);
  });

  beforeEach(() => {
    cy.loginAsDemo();
  });

  it('Step 1: With loose rule -> APPROVED', () => {
    // Ensure the seeded expression is the most recently updated Active one
    cy.request('GET', `${API}/api/expressions/by-expression-id/${looseExpr.ExpressionId}`).then((res) => {
      expect(res.status).to.eq(200);
      const id = res.body?.id;
      expect(id, 'expression guid id').to.exist;
      return cy.request({
        method: 'PUT',
        url: `${API}/api/expressions/${id}`,
        body: { ExpressionText: looseExpr.ExpressionText },
        failOnStatusCode: false,
      }).then((putRes) => {
        expect([200]).to.include(putRes.status);
      });
    });
    cy.visit('/loans/new');
    cy.contains('Apply for a Loan');
    fillLoanForm();
    closeAnyBackdrop();
    cy.contains('button', 'Pre-Validate').scrollIntoView().click({ force: true });
    cy.contains(/Eligibility:\s*APPROVED/i, { timeout: 8000 }).should('be.visible');
  });

  it('Step 2: After strict rule -> DECLINED', () => {
    // Update the same expression to strict by fetching its GUID and calling PUT
    cy.request('GET', `${API}/api/expressions/by-expression-id/${looseExpr.ExpressionId}`).then((res) => {
      expect(res.status).to.eq(200);
      const id = res.body?.id;
      expect(id, 'expression guid id').to.exist;
      return cy.request({
        method: 'PUT',
        url: `${API}/api/expressions/${id}`,
        body: { ExpressionText: strictExprText },
        failOnStatusCode: false,
      }).then((putRes) => {
        expect([200]).to.include(putRes.status);
      });
    });
    cy.visit('/loans/new');
    cy.contains('Apply for a Loan');
    fillLoanForm();
    closeAnyBackdrop();
    cy.contains('button', 'Pre-Validate').scrollIntoView().click({ force: true });
    cy.contains(/Eligibility:\s*DECLINED/i, { timeout: 8000 }).should('be.visible');
  });
});

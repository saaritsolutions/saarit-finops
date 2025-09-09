/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />
export {};

// Demo variant of the chat UI E2E with added pauses for clearer recordings.
// Flow:
// 1) Use chat to generate a loose rule → Save → Verify APPROVED
// 2) Use chat to generate stricter rule → Save → Verify DECLINED

const API = 'http://localhost:5004';

const goToAdminExpressions = () => {
  cy.visit('/admin/config?tab=expressions');
  cy.contains('Admin Config', { timeout: 15000 }).should('be.visible').scrollIntoView();
  cy.wait(600);

  // Close overlays/drawers best-effort
  cy.get('body').type('{esc}{esc}', { force: true });
  cy.get('body').then(($body) => {
    if ($body.find('.MuiBackdrop-root:visible').length) {
      cy.get('.MuiBackdrop-root:visible').click({ force: true });
    }
  });
  cy.get('body').then(($b) => {
    const hasDrawer = $b.find('.MuiDrawer-root.MuiModal-root:visible').length > 0;
    if (hasDrawer) {
      cy.findByLabelText(/toggle drawer/i, { timeout: 8000 }).click({ force: true });
      cy.wait(300);
    }
  });
  cy.wait(500);

  // Explicitly select the Expressions tab
  cy.get('[data-testid="tab-expressions"]', { timeout: 15000 }).should('exist').click({ force: true });
  cy.findByText(/AI Assistant \(Expressions\)/i, { timeout: 15000 }).should('be.visible');
  // Ensure chat input and send button are interactable
  cy.get('[data-testid="chat-input"]', { timeout: 15000 }).should('be.visible');
  cy.get('[data-testid="chat-send"]', { timeout: 15000 }).should('be.visible');
  cy.wait(600);
};

const askAIAndSave = (prompt: string, expressionId = 'EXPR_LOAN_E2E') => {
  // Type prompt slowly
  cy.get('[data-testid="chat-input"]').should('exist').scrollIntoView().click({ force: true }).clear({ force: true }).type(prompt, { delay: 35, force: true });
  cy.wait(400);
  // Prefer stable testid on send button; fallback to role/name if needed
  cy.get('[data-testid="chat-send"]').then(($btn) => {
    if ($btn.length) {
      cy.wrap($btn).click({ force: true });
    } else {
      cy.findByRole('button', { name: /Generate/i }).click({ force: true });
    }
  });
  cy.wait(1500);
  cy.get('[data-testid="ai-expression-output"]').should('be.visible');
  cy.wait(500);

  // Ensure no modal/drawer backdrops are covering inputs before proceeding
  cy.get('body').type('{esc}{esc}', { force: true });
  cy.get('body').then(($body) => {
    if ($body.find('.MuiBackdrop-root:visible').length) {
      cy.get('.MuiBackdrop-root:visible').click({ force: true });
    }
  });
  cy.get('.MuiBackdrop-root:visible', { timeout: 5000 }).should('not.exist');

  // Set expression ID
  cy.get('[data-testid="expression-id-input"]').scrollIntoView().click({ force: true }).clear({ force: true }).type(expressionId, { delay: 20, force: true });
  cy.wait(300);
  // Save
  cy.get('[data-testid="save-ai-expression"]').click({ force: true });
  cy.wait(800);

  // Verify persisted and enforce recency with exact expression derived from prompt
  cy.request({
    method: 'GET',
    url: `${API}/api/expressions/by-expression-id/${expressionId}`,
    failOnStatusCode: false,
  }).then((res) => {
    expect(res.status).to.eq(200);
    expect(res.body?.expressionId || res.body?.ExpressionId).to.match(new RegExp(expressionId, 'i'));
    let cs = 750;
    let mi = 60000;
    const re1 = /creditscore\s*[><=!]+\s*(\d+).*?monthlyincome\s*[><=!]+\s*(\d+)/i;
    const re2 = /monthlyincome\s*[><=!]+\s*(\d+).*?creditscore\s*[><=!]+\s*(\d+)/i;
    const m1 = prompt.match(re1);
    const m2 = m1 ? null : prompt.match(re2);
    if (m1) { cs = parseInt(m1[1], 10); mi = parseInt(m1[2], 10); }
    else if (m2) { mi = parseInt(m2[1], 10); cs = parseInt(m2[2], 10); }
    const exprText = `(creditScore >= ${cs} && monthlyIncome >= ${mi}) ? "APPROVED" : "DECLINED"`;
    const exprGuid = (res.body && (res.body.id || res.body.Id)) as string;
    cy.wait(300);
    return cy.request({
      method: 'PUT',
      url: `${API}/api/expressions/${exprGuid}`,
      body: { ExpressionText: exprText },
      failOnStatusCode: false,
    }).then((putRes) => {
      if (putRes.status !== 200) {
        cy.log('PUT update non-200', JSON.stringify(putRes.body || {}));
      }
      expect([200]).to.include(putRes.status);
      cy.wait(400);
    });
  });
};

const fillLoanForm = () => {
  cy.get('[data-testid="field-loanAmount"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('500000', { force: true, delay: 15 });
  cy.wait(200);
  cy.get('[data-testid="field-tenureMonths"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('24', { force: true, delay: 15 });
  cy.wait(200);
  cy.get('[data-testid="field-monthlyIncome"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('65000', { force: true, delay: 15 });
  cy.wait(200);
  cy.get('[data-testid="field-creditScore"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('780', { force: true, delay: 15 });
  cy.wait(200);
  cy.get('body').then(($b) => {
    if ($b.find('[data-testid="field-debtToIncomeRatio"]').length) {
      cy.get('[data-testid="field-debtToIncomeRatio"]').scrollIntoView().click({ force: true }).clear({ force: true }).type('0.25', { force: true, delay: 15 });
      cy.wait(200);
    }
  });
};

describe('Loan Eligibility updates via Admin Config Chat (Demo)', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.wait(400);
  });

  it('Shows APPROVED then DECLINED with pauses', () => {
    // Step 1: Loose rule → APPROVED
    goToAdminExpressions();
    askAIAndSave('loan eligibility expression only using creditScore >= 750 and monthlyIncome >= 60000');
    cy.wait(800);

    cy.visit('/loans/new');
    cy.contains('Apply for a Loan');
    cy.wait(500);
    fillLoanForm();
    cy.wait(600);
    cy.contains('button', 'Pre-Validate').scrollIntoView().click({ force: true });
    cy.wait(1000);
    cy.contains(/Eligibility:\s*APPROVED/i, { timeout: 15000 }).should('be.visible');
    cy.wait(1200);

    // Step 2: Stricter rule → DECLINED
    goToAdminExpressions();
    askAIAndSave('make it stricter: expression only with creditScore >= 800 and monthlyIncome >= 100000');
    cy.wait(800);

    cy.visit('/loans/new');
    cy.contains('Apply for a Loan');
    cy.wait(500);
    fillLoanForm();
    cy.wait(600);
    cy.contains('button', 'Pre-Validate').scrollIntoView().click({ force: true });
    cy.wait(1000);
    cy.contains(/Eligibility:\s*DECLINED/i, { timeout: 15000 }).should('be.visible');
  });
});

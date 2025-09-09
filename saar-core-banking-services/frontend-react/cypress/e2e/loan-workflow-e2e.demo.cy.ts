/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />
export {};

// Demo helpers: add small delays before navigating and clicking buttons for clearer recordings
const DEMO_PAUSE_MS = Number(Cypress.env('demoPauseMs') ?? 800);
const demoPause = () => cy.wait(DEMO_PAUSE_MS);

// Helpers to interact with Admin Config workflow chat (demo version)
const openAdminConfig = () => {
  demoPause();
  cy.visit('/admin/config');
  demoPause();
  cy.contains('Workflow', { matchCase: false }).scrollIntoView();
  demoPause();
  cy.contains('Workflow', { matchCase: false }).click({ force: true });
};

const updateWorkflowByChat = (message: string) => {
  cy.contains('AI Assistant (Workflow)')
    .closest('.MuiCard-root')
    .within(() => {
      cy.get('textarea')
        .first()
        .should('exist')
        .scrollIntoView()
        .click({ force: true })
        .clear({ force: true })
        .type(message, { force: true });
      demoPause();
      cy.contains(/apply/i).scrollIntoView();
      demoPause();
      cy.contains(/apply/i).click({ force: true });
    });
  cy.contains(/Workflow updated from AI/i, { timeout: 8000 }).should('exist');
  demoPause();
  cy.contains(/save workflow/i).scrollIntoView();
  demoPause();
  cy.contains(/save workflow/i).click({ force: true });
  cy.contains(/Workflow saved/i, { timeout: 6000 }).should('exist');
};

const closeAnyBackdrop = () => {
  cy.get('body').then(($body) => {
    const hasBackdrop = $body.find('.MuiBackdrop-root:visible').length > 0;
    if (hasBackdrop) {
      cy.findAllByLabelText(/toggle drawer/i).then(($btns) => {
        if ($btns.length) cy.wrap($btns.first()).click({ force: true });
      });
      cy.get('body').type('{esc}', { force: true });
      cy.get('.MuiBackdrop-root:visible').click({ force: true }).should('not.exist');
    }
  });
};

const startLoanFlow = () => {
  demoPause();
  cy.visit('/loans/new');
  cy.contains('Apply for a Loan');
  closeAnyBackdrop();
};

const safeTypeByTestId = (name: string, text: string) => {
  cy.get(`[data-testid="field-${name}"]`)
    .scrollIntoView()
    .click({ force: true })
    .clear({ force: true })
    .type(text, { force: true });
};

const fillBasicForm = (opts: { aadhar?: string } = {}) => {
  closeAnyBackdrop();
  safeTypeByTestId('loanAmount', '500000');
  safeTypeByTestId('tenureMonths', '24');
  safeTypeByTestId('monthlyIncome', '75000');
  safeTypeByTestId('creditScore', '780');
  cy.get('body').then(($b) => {
    if ($b.find('[data-testid="field-debtToIncomeRatio"]').length) {
      safeTypeByTestId('debtToIncomeRatio', '0.25');
    }
  });
  if (opts.aadhar) {
    cy.get('body').then(($b) => {
      if ($b.find('[data-testid="field-aadharNumber"]').length) {
        safeTypeByTestId('aadharNumber', opts.aadhar!);
      }
    });
  }
};

const submitAndExpectNoKyc = () => {
  closeAnyBackdrop();
  cy.contains('button', 'Pre-Validate').scrollIntoView();
  demoPause();
  cy.contains('button', 'Pre-Validate').click({ force: true });
  cy.contains(/Eligibility:/i, { timeout: 7000 });
  closeAnyBackdrop();
  cy.contains('button', 'Submit').scrollIntoView();
  demoPause();
  cy.contains('button', 'Submit').click({ force: true });
  cy.contains(/Submission Result/i, { timeout: 7000 });
  cy.contains(/Required:/i).should('not.exist');
  cy.contains('button', 'Advance Step').should('not.be.disabled');
};

const submitAndExpectOptionalKyc = () => {
  closeAnyBackdrop();
  cy.contains('button', 'Submit').scrollIntoView();
  demoPause();
  cy.contains('button', 'Submit').click({ force: true });
  cy.contains(/Submission Result/i, { timeout: 7000 });
  cy.contains(/KYC/i);
  cy.contains('button', 'Advance Step').should('not.be.disabled');
};

const submitAndExpectMandatoryKyc = () => {
  closeAnyBackdrop();
  cy.contains('button', 'Submit').scrollIntoView();
  demoPause();
  cy.contains('button', 'Submit').click({ force: true });
  cy.contains(/Submission Result/i, { timeout: 7000 });
  cy.contains('button', 'Advance Step').then(($btn) => {
    if (!$btn.is(':disabled')) {
      demoPause();
      cy.wrap($btn).scrollIntoView().click({ force: true });
    }
  });
  cy.contains(/Required:.*KYC/i, { timeout: 7000 });
  cy.contains('button', 'Advance Step').should('be.disabled');
};

const completeKycAndAdvance = (aadhar: string) => {
  cy.get('body').then(($b) => {
    if ($b.find('[data-testid="field-aadharNumber"]').length) {
      cy.get('[data-testid="field-aadharNumber"]').scrollIntoView().click({ force: true }).clear({ force: true }).type(aadhar, { force: true });
    } else {
      cy.findAllByLabelText(/Aadhar Number/i).then(($els: JQuery<HTMLElement>) => {
        if ($els.length > 0) {
          cy.wrap($els.first()).scrollIntoView().click({ force: true }).clear({ force: true }).type(aadhar, { force: true });
        }
      });
    }
  });
  closeAnyBackdrop();
  cy.contains('button', /\bKYC\b|Perform KYC/i).first().scrollIntoView();
  demoPause();
  cy.contains('button', /\bKYC\b|Perform KYC/i).first().click({ force: true });
  cy.wait(500);
  cy.contains('button', 'Advance Step').scrollIntoView();
  demoPause();
  cy.contains('button', 'Advance Step').click({ force: true });
};

describe('Loan Workflow Demo E2E (with pauses)', () => {
  beforeEach(() => {
    cy.loginAsDemo();
  });

  it('1) New loan without Aadhar and KYC validations (demo)', () => {
    openAdminConfig();
    updateWorkflowByChat('remove kyc check');

    startLoanFlow();
    fillBasicForm();
    submitAndExpectNoKyc();
  });

  it('2) New loan with Aadhar in form, complete the flow (demo)', () => {
    openAdminConfig();
    updateWorkflowByChat('remove kyc required action');

    startLoanFlow();
    fillBasicForm({ aadhar: '123456789012' });
    closeAnyBackdrop();
    cy.contains('button', 'Pre-Validate').scrollIntoView();
    demoPause();
    cy.contains('button', 'Pre-Validate').click({ force: true });
    cy.contains(/Eligibility:/i, { timeout: 7000 });
    closeAnyBackdrop();
    cy.contains('button', 'Submit').scrollIntoView();
    demoPause();
    cy.contains('button', 'Submit').click({ force: true });
    cy.contains(/Submission Result/i, { timeout: 7000 });
    cy.contains('button', 'Advance Step').scrollIntoView();
    demoPause();
    cy.contains('button', 'Advance Step').click({ force: true });
  });

  it('3) New loan after adding optional KYC verification (demo)', () => {
    openAdminConfig();
    updateWorkflowByChat('add kyc step (optional)');

    startLoanFlow();
    fillBasicForm();
    submitAndExpectOptionalKyc();
    completeKycAndAdvance('123456789012');
  });

  it('4) New loan with mandatory KYC verification (demo)', () => {
    openAdminConfig();
    updateWorkflowByChat('enable kyc verification as mandatory required action');

    startLoanFlow();
    fillBasicForm();
    submitAndExpectMandatoryKyc();
    completeKycAndAdvance('123456789012');
  });
});

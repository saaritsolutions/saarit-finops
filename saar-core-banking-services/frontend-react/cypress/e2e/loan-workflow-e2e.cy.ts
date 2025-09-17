/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />
export {};

// Global timeout configuration for OpenAI API calls
const TIMEOUTS = {
  OPENAI_API: 60000,        // 60 seconds for OpenAI API responses
  FORM_SUBMISSION: 60000,   // 60 seconds for form submissions with AI processing
  WORKFLOW_UPDATE: 60000,   // 60 seconds for workflow updates
  STANDARD_WAIT: 7000,      // 7 seconds for standard UI operations
  SHORT_WAIT: 500          // 500ms for quick UI transitions
};

// Helpers to interact with Admin Config workflow chat
const openAdminConfig = () => {
  cy.visit('/admin/config');
  cy.contains('Workflow', { matchCase: false }).click({ force: true });
};

const updateWorkflowByChat = (message: string) => {
  // Target the Workflow chat panel by its heading and act within it
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
      cy.contains(/apply/i).click({ force: true });
    });
  // Wait for the status banner to confirm update
  cy.contains(/Workflow updated from AI/i, { timeout: TIMEOUTS.WORKFLOW_UPDATE }).should('exist');
  // Save workflow
  cy.contains(/save workflow/i).click({ force: true });
  cy.contains(/Workflow saved/i, { timeout: TIMEOUTS.WORKFLOW_UPDATE }).should('exist');
};

const closeAnyBackdrop = () => {
  cy.get('body').then(($body) => {
    const hasBackdrop = $body.find('.MuiBackdrop-root:visible').length > 0;
    if (hasBackdrop) {
      // Try closing via toggle button if present
      cy.findAllByLabelText(/toggle drawer/i).then(($btns) => {
        if ($btns.length) cy.wrap($btns.first()).click({ force: true });
      });
      // Fallback: press escape and click the backdrop
      cy.get('body').type('{esc}', { force: true });
      cy.get('.MuiBackdrop-root:visible').click({ force: true }).should('not.exist');
    }
  });
};

const startLoanFlow = () => {
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
  // Use stable field names expected by services
  safeTypeByTestId('loanAmount', '500000');
  safeTypeByTestId('tenureMonths', '24');
  safeTypeByTestId('monthlyIncome', '75000');
  safeTypeByTestId('creditScore', '780');
  // debtToIncomeRatio may not exist in some schemas; if missing, skip
  cy.get('body').then(($b) => {
    if ($b.find('[data-testid="field-debtToIncomeRatio"]').length) {
      safeTypeByTestId('debtToIncomeRatio', '0.25');
    }
  });
  if (opts.aadhar) {
    // Optional KYC input may appear as an extra TextField when kycRequired
    cy.get('body').then(($b) => {
      if ($b.find('[data-testid="field-aadharNumber"]').length) {
        safeTypeByTestId('aadharNumber', opts.aadhar!);
      }
    });
  }
};

const submitAndExpectNoKyc = () => {
  closeAnyBackdrop();
  cy.contains('button', 'Pre-Validate').scrollIntoView().click({ force: true });
  cy.contains(/Eligibility:/i, { timeout: TIMEOUTS.FORM_SUBMISSION });
  closeAnyBackdrop();
  cy.contains('button', 'Submit').scrollIntoView().click({ force: true });
  cy.contains(/Submission Result/i, { timeout: TIMEOUTS.FORM_SUBMISSION });
  // No required actions should be shown, and Advance Step should be enabled
  cy.contains(/Required:/i).should('not.exist');
  cy.contains('button', 'Advance Step').should('not.be.disabled');
};

const submitAndExpectOptionalKyc = () => {
  closeAnyBackdrop();
  cy.contains('button', 'Submit').scrollIntoView().click({ force: true });
  cy.contains(/Submission Result/i, { timeout: TIMEOUTS.FORM_SUBMISSION });
  // Optional KYC: show step or hint but allow Advance Step
  cy.contains(/KYC/i);
  cy.contains('button', 'Advance Step').should('not.be.disabled');
};

const submitAndExpectMandatoryKyc = () => {
  closeAnyBackdrop();
  cy.contains('button', 'Submit').scrollIntoView().click({ force: true });
  cy.contains(/Submission Result/i, { timeout: TIMEOUTS.FORM_SUBMISSION });
  // Try advancing if not disabled, then KYC required should surface and advance becomes disabled
  cy.contains('button', 'Advance Step').then(($btn) => {
    if (!$btn.is(':disabled')) {
      cy.wrap($btn).scrollIntoView().click({ force: true });
    }
  });
  cy.contains(/Required:.*KYC/i, { timeout: TIMEOUTS.STANDARD_WAIT });
  cy.contains('button', 'Advance Step').should('be.disabled');
};

const completeKycAndAdvance = (aadhar: string) => {
  // Perform KYC action
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
  // Click KYC action button (label normalized in UI)
  closeAnyBackdrop();
  cy.contains('button', /\bKYC\b|Perform KYC/i).first().scrollIntoView().click({ force: true });
  cy.wait(TIMEOUTS.SHORT_WAIT);
  // Advance after KYC
  cy.contains('button', 'Advance Step').scrollIntoView().click({ force: true });
};

describe('Loan Workflow & Dynamic Form E2E', () => {
  beforeEach(() => {
    cy.loginAsDemo();
  });

  it('1) New loan without Aadhar and KYC validations', () => {
    openAdminConfig();
    updateWorkflowByChat('remove kyc check');

    startLoanFlow();
    fillBasicForm();
    submitAndExpectNoKyc();
  });

  it('2) New loan application with Aadhar in form, complete the flow', () => {
    // Add Aadhar via AI Form Designer apply API would be complex; here rely on runtime KYC field when needed
    // Ensure workflow has no mandatory KYC so we can proceed normally
    openAdminConfig();
    updateWorkflowByChat('remove kyc required action');

    startLoanFlow();
    fillBasicForm({ aadhar: '123456789012' });
  closeAnyBackdrop();
  cy.contains('button', 'Pre-Validate').scrollIntoView().click({ force: true });
    cy.contains(/Eligibility:/i, { timeout: TIMEOUTS.FORM_SUBMISSION });
  closeAnyBackdrop();
  cy.contains('button', 'Submit').scrollIntoView().click({ force: true });
    cy.contains(/Submission Result/i, { timeout: TIMEOUTS.FORM_SUBMISSION });
    // Even if KYC step name appears, advancing should be allowed if no RequiredActions
  cy.contains('button', 'Advance Step').scrollIntoView().click({ force: true });
  });

  it('3) New loan application after adding optional KYC verification', () => {
    openAdminConfig();
    updateWorkflowByChat('add kyc step (optional)');

    startLoanFlow();
    fillBasicForm();
    submitAndExpectOptionalKyc();
    // Optionally perform KYC and proceed
    completeKycAndAdvance('123456789012');
  });

  it('4) New loan application with mandatory KYC verification', () => {
    openAdminConfig();
    updateWorkflowByChat('enable kyc verification as mandatory required action');

    startLoanFlow();
    fillBasicForm();
    submitAndExpectMandatoryKyc();
    completeKycAndAdvance('123456789012');
  });
});

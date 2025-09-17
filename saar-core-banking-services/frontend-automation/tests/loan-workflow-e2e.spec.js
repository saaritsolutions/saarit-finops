import { test, expect } from '@playwright/test';

// Global timeout configuration for OpenAI API calls
const TIMEOUTS = {
  OPENAI_API: 60000,        // 60 seconds for OpenAI API responses
  FORM_SUBMISSION: 60000,   // 60 seconds for form submissions with AI processing
  WORKFLOW_UPDATE: 60000,   // 60 seconds for workflow updates
  STANDARD_WAIT: 7000,      // 7 seconds for standard UI operations
  SHORT_WAIT: 500          // 500ms for quick UI transitions
};

// Helper to perform demo login
const loginAsDemo = async (page) => {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', 'admin@saarbanking.com');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"], button:has-text("Sign In")');
  await page.waitForTimeout(2000); // Allow authentication to complete
};

// Helpers to interact with Admin Config workflow chat
const openAdminConfig = async (page) => {
  await page.goto('/admin/config', { waitUntil: 'networkidle' });
  await page.locator('text=Workflow').click({ force: true });
};

const updateWorkflowByChat = async (page, message) => {
  // Target the Workflow chat panel by its heading and act within it
  const workflowCard = page.locator('text=AI Assistant (Workflow)').locator('..').locator('.MuiCard-root');
  
  await workflowCard.locator('textarea').first().scrollIntoView();
  await workflowCard.locator('textarea').first().click({ force: true });
  await workflowCard.locator('textarea').first().clear();
  await workflowCard.locator('textarea').first().fill(message);
  await workflowCard.locator('text=/apply/i').click({ force: true });
  
  // Wait for the status banner to confirm update
  await expect(page.locator('text=/Workflow updated from AI/i')).toBeVisible({ timeout: TIMEOUTS.WORKFLOW_UPDATE });
  
  // Save workflow
  await page.locator('text=/save workflow/i').click({ force: true });
  await expect(page.locator('text=/Workflow saved/i')).toBeVisible({ timeout: TIMEOUTS.WORKFLOW_UPDATE });
};

const closeAnyBackdrop = async (page) => {
  try {
    const backdrop = page.locator('.MuiBackdrop-root').first();
    if (await backdrop.isVisible()) {
      // Try closing via toggle button if present
      const toggleButtons = page.locator('[aria-label*="toggle drawer" i]');
      if (await toggleButtons.count() > 0) {
        await toggleButtons.first().click({ force: true });
      }
      // Fallback: press escape and click the backdrop
      await page.keyboard.press('Escape');
      await backdrop.click({ force: true });
      await expect(backdrop).not.toBeVisible();
    }
  } catch (error) {
    // Ignore backdrop errors - might not exist
  }
};

const startLoanFlow = async (page) => {
  await page.goto('/loans/new', { waitUntil: 'networkidle' });
  await expect(page.locator('text=Apply for a Loan')).toBeVisible();
  await closeAnyBackdrop(page);
};

const safeTypeByTestId = async (page, name, text) => {
  const field = page.locator(`[data-testid="field-${name}"]`);
  await field.scrollIntoView();
  await field.click({ force: true });
  await field.clear();
  await field.fill(text);
};

const fillBasicForm = async (page, opts = {}) => {
  await closeAnyBackdrop(page);
  
  // Use stable field names expected by services
  await safeTypeByTestId(page, 'loanAmount', '500000');
  await safeTypeByTestId(page, 'tenureMonths', '24');
  await safeTypeByTestId(page, 'monthlyIncome', '75000');
  await safeTypeByTestId(page, 'creditScore', '780');
  
  // debtToIncomeRatio may not exist in some schemas; if missing, skip
  const debtField = page.locator('[data-testid="field-debtToIncomeRatio"]');
  if (await debtField.count() > 0) {
    await safeTypeByTestId(page, 'debtToIncomeRatio', '0.25');
  }
  
  if (opts.aadhar) {
    // Optional KYC input may appear as an extra TextField when kycRequired
    const aadharField = page.locator('[data-testid="field-aadharNumber"]');
    if (await aadharField.count() > 0) {
      await safeTypeByTestId(page, 'aadharNumber', opts.aadhar);
    }
  }
};

const submitAndExpectNoKyc = async (page) => {
  await closeAnyBackdrop(page);
  await page.locator('button:has-text("Pre-Validate")').scrollIntoView();
  await page.locator('button:has-text("Pre-Validate")').click({ force: true });
  await expect(page.locator('text=/Eligibility:/i')).toBeVisible({ timeout: TIMEOUTS.FORM_SUBMISSION });
  
  await closeAnyBackdrop(page);
  await page.locator('button:has-text("Submit")').scrollIntoView();
  await page.locator('button:has-text("Submit")').click({ force: true });
  await expect(page.locator('text=/Submission Result/i')).toBeVisible({ timeout: TIMEOUTS.FORM_SUBMISSION });
  
  // No required actions should be shown, and Advance Step should be enabled
  await expect(page.locator('text=/Required:/i')).not.toBeVisible();
  await expect(page.locator('button:has-text("Advance Step")')).not.toBeDisabled();
};

const submitAndExpectOptionalKyc = async (page) => {
  await closeAnyBackdrop(page);
  await page.locator('button:has-text("Submit")').scrollIntoView();
  await page.locator('button:has-text("Submit")').click({ force: true });
  await expect(page.locator('text=/Submission Result/i')).toBeVisible({ timeout: TIMEOUTS.FORM_SUBMISSION });
  
  // Optional KYC: show step or hint but allow Advance Step
  await expect(page.locator('text=/KYC/i')).toBeVisible();
  await expect(page.locator('button:has-text("Advance Step")')).not.toBeDisabled();
};

const submitAndExpectMandatoryKyc = async (page) => {
  await closeAnyBackdrop(page);
  await page.locator('button:has-text("Submit")').scrollIntoView();
  await page.locator('button:has-text("Submit")').click({ force: true });
  await expect(page.locator('text=/Submission Result/i')).toBeVisible({ timeout: TIMEOUTS.FORM_SUBMISSION });
  
  // Try advancing if not disabled, then KYC required should surface and advance becomes disabled
  const advanceButton = page.locator('button:has-text("Advance Step")');
  const isDisabled = await advanceButton.isDisabled();
  if (!isDisabled) {
    await advanceButton.scrollIntoView();
    await advanceButton.click({ force: true });
  }
  
  await expect(page.locator('text=/Required:.*KYC/i')).toBeVisible({ timeout: TIMEOUTS.STANDARD_WAIT });
  await expect(page.locator('button:has-text("Advance Step")')).toBeDisabled();
};

const completeKycAndAdvance = async (page, aadhar) => {
  // Perform KYC action
  const testIdField = page.locator('[data-testid="field-aadharNumber"]');
  if (await testIdField.count() > 0) {
    await testIdField.scrollIntoView();
    await testIdField.click({ force: true });
    await testIdField.clear();
    await testIdField.fill(aadhar);
  } else {
    // Fallback to aria-label search
    const labelField = page.locator('[aria-label*="Aadhar Number" i]').first();
    if (await labelField.count() > 0) {
      await labelField.scrollIntoView();
      await labelField.click({ force: true });
      await labelField.clear();
      await labelField.fill(aadhar);
    }
  }
  
  // Click KYC action button (label normalized in UI)
  await closeAnyBackdrop(page);
  await page.locator('button:has-text(/KYC|Perform KYC/i)').first().scrollIntoView();
  await page.locator('button:has-text(/KYC|Perform KYC/i)').first().click({ force: true });
  await page.waitForTimeout(TIMEOUTS.SHORT_WAIT);
  
  // Advance after KYC
  await page.locator('button:has-text("Advance Step")').scrollIntoView();
  await page.locator('button:has-text("Advance Step")').click({ force: true });
};

test.describe('Loan Workflow & Dynamic Form E2E', () => {
  test.beforeEach(async ({ page, context }) => {
    // Ensure single page/window usage
    const pages = context.pages();
    if (pages.length > 1) {
      // Close any extra pages except the current one
      for (let i = 1; i < pages.length; i++) {
        await pages[i].close();
      }
    }
    
    await loginAsDemo(page);
  });

  test('1) New loan without Aadhar and KYC validations', async ({ page }) => {
    await openAdminConfig(page);
    await updateWorkflowByChat(page, 'remove kyc check');

    await startLoanFlow(page);
    await fillBasicForm(page);
    await submitAndExpectNoKyc(page);
  });

  test('2) New loan application with Aadhar in form, complete the flow', async ({ page }) => {
    // Add Aadhar via AI Form Designer apply API would be complex; here rely on runtime KYC field when needed
    // Ensure workflow has no mandatory KYC so we can proceed normally
    await openAdminConfig(page);
    await updateWorkflowByChat(page, 'remove kyc required action');

    await startLoanFlow(page);
    await fillBasicForm(page, { aadhar: '123456789012' });
    
    await closeAnyBackdrop(page);
    await page.locator('button:has-text("Pre-Validate")').scrollIntoView();
    await page.locator('button:has-text("Pre-Validate")').click({ force: true });
    await expect(page.locator('text=/Eligibility:/i')).toBeVisible({ timeout: TIMEOUTS.FORM_SUBMISSION });
    
    await closeAnyBackdrop(page);
    await page.locator('button:has-text("Submit")').scrollIntoView();
    await page.locator('button:has-text("Submit")').click({ force: true });
    await expect(page.locator('text=/Submission Result/i')).toBeVisible({ timeout: TIMEOUTS.FORM_SUBMISSION });
    
    // Even if KYC step name appears, advancing should be allowed if no RequiredActions
    await page.locator('button:has-text("Advance Step")').scrollIntoView();
    await page.locator('button:has-text("Advance Step")').click({ force: true });
  });

  test('3) New loan application after adding optional KYC verification', async ({ page }) => {
    await openAdminConfig(page);
    await updateWorkflowByChat(page, 'add kyc step (optional)');

    await startLoanFlow(page);
    await fillBasicForm(page);
    await submitAndExpectOptionalKyc(page);
    // Optionally perform KYC and proceed
    await completeKycAndAdvance(page, '123456789012');
  });

  test('4) New loan application with mandatory KYC verification', async ({ page }) => {
    await openAdminConfig(page);
    await updateWorkflowByChat(page, 'enable kyc verification as mandatory required action');

    await startLoanFlow(page);
    await fillBasicForm(page);
    await submitAndExpectMandatoryKyc(page);
    await completeKycAndAdvance(page, '123456789012');
  });
});
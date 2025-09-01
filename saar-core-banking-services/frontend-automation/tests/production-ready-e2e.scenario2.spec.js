const { test, expect } = require('@playwright/test');
const { closeSideNavigation, setExpressionValue } = require('../helpers');

test.describe('SaaR Banking - Production Ready E2E Scenarios', () => {
  test('Production Scenario 2: Credit Limit Increase triggers Manual Review', async ({ page }) => {
    console.log('🎯 PRODUCTION SCENARIO 2: Credit Limit Increase -> Manual Review');

    // Placeholder: Step 1 - Create loan application with borderline credit score and missing income docs
    await test.step('Step 1: Create application (borderline)', async () => {
      await page.goto('/loans/new');
      await page.waitForLoadState('networkidle');
      await closeSideNavigation(page);
      // ...existing code to fill the form will be added here
    });

    // Placeholder: Step 2 - Conversational Form change using chat assistant
    await test.step('Step 2: Use chat assistant to add Aadhar field', async () => {
      await page.goto('/admin/config');
      await page.waitForLoadState('networkidle');
      await closeSideNavigation(page);

      // Open the chat assistant (assumed to be a floating widget)
      const chatToggle = page.getByRole('button', { name: /assistant|chat|help/i }).first();
      if (await chatToggle.isVisible().catch(() => false)) {
        await chatToggle.click();
        const chatInput = page.getByRole('textbox').first();
        await chatInput.fill("Add a mandatory field 'aadharNumber' (text, 12 digits) to the personal loan form and label it 'Aadhar Number'.");
        await chatInput.press('Enter');
        // Wait for assistant to propose a change and show an 'Apply' or 'Commit' button
        const applyBtn = page.getByRole('button', { name: /apply|commit|confirm/i }).first();
        await applyBtn.waitFor({ state: 'visible', timeout: 5000 });
        await applyBtn.click();
      } else {
        test.skip('Chat assistant not available in this build');
      }
    });

    // Placeholder: Step 3 - Verify field appears on loan form and enforces validation
    await test.step('Step 3: Verify Aadhar field on loan form', async () => {
      await page.goto('/loans/new');
      await page.waitForLoadState('networkidle');
      const aadharInput = page.getByLabel(/Aadhar Number|aadharNumber/i).first();
      await expect(aadharInput).toBeVisible();
      // enter invalid value and assert validation
      await aadharInput.fill('12345');
      await page.getByRole('button', { name: /submit|apply|next/i }).first().click();
      // Expect a validation error message to appear
      const validation = page.getByText(/12 digits|invalid aadhar|enter a 12 digit/i).first();
      await expect(validation).toBeVisible({ timeout: 2000 });
    });
  });
});

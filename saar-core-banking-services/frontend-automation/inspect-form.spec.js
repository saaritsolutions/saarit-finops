import { test, expect } from '@playwright/test';

test('Form Structure Inspector', async ({ page }) => {
  await page.goto('/loans/new');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Inspect all input fields
  const inputs = await page.locator('input').all();
  console.log(`Found ${inputs.length} input fields`);
  
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const type = await input.getAttribute('type');
    const label = await input.getAttribute('aria-label') || await input.getAttribute('label') || await input.getAttribute('placeholder');
    const name = await input.getAttribute('name');
    const id = await input.getAttribute('id');
    
    console.log(`Input ${i + 1}: type="${type}", label="${label}", name="${name}", id="${id}"`);
  }
  
  // Check for labels
  const labels = await page.locator('label').all();
  console.log(`\nFound ${labels.length} labels`);
  
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const text = await label.textContent();
    const forAttr = await label.getAttribute('for');
    
    console.log(`Label ${i + 1}: text="${text}", for="${forAttr}"`);
  }
  
  // Take a screenshot for visual inspection
  await page.screenshot({ path: 'form-structure-inspection.png', fullPage: true });
  
  // Check the page HTML structure
  const html = await page.content();
  console.log('\nPage HTML structure (first 2000 chars):');
  console.log(html.substring(0, 2000));
});

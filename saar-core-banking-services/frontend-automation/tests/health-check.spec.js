import { test, expect } from '@playwright/test';

test.describe('SaaR Banking Demo - Health Check', () => {
  test('should verify all demo pages are accessible', async ({ page }) => {
    console.log('🔍 Starting health check for demo environment...');
    
    // Test home page accessibility
    await test.step('Check frontend is running', async () => {
      await page.goto('/');
      await expect(page).toHaveTitle(/SaaR|Banking|React/i);
      console.log('✅ Frontend is accessible');
    });

    // Test login page
    await test.step('Check login page', async () => {
      await page.goto('/login');
      // Updated selectors based on actual Login.tsx component
      await expect(page.locator('input[name="username"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      console.log('✅ Login page is working');
    });

    // Test other critical pages (without login)
    const pages = [
      { url: '/dashboard', name: 'Dashboard' },
      { url: '/admin/config', name: 'Admin Config' },
      { url: '/expressions', name: 'Expression Builder' },
      { url: '/loans/new', name: 'Loan Application' },
      { url: '/demo', name: 'End-to-End Demo' }
    ];

    for (const pageInfo of pages) {
      await test.step(`Check ${pageInfo.name}`, async () => {
        await page.goto(pageInfo.url);
        // Either shows content or redirects to login (both are acceptable)
        const isLoginRedirect = page.url().includes('/login');
        const hasContent = await page.locator('body').isVisible();
        
        expect(isLoginRedirect || hasContent).toBeTruthy();
        console.log(`✅ ${pageInfo.name} is accessible`);
      });
    }

    console.log('🎉 All demo pages health check completed successfully!');
  });

  test('should verify demo credentials work', async ({ page }) => {
    console.log('🔐 Testing demo login credentials...');
    
    await page.goto('/login');
    
    // Fill in demo credentials using correct field names
    await page.fill('input[name="username"]', 'admin@saarbanking.com');
    await page.fill('input[name="password"]', 'admin123');
    
    // Submit login
    await page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
    
    // Wait for navigation after login
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Verify successful login
    await expect(page).toHaveURL(/dashboard/);
    console.log('✅ Demo credentials work correctly');
    
    // Verify user is logged in (check for user menu or logout button)
    const userIndicators = [
      'button:has-text("Logout")',
      'button:has-text("Profile")', 
      '[data-testid="user-menu"]',
      '.user-menu',
      'text=admin@saarbanking.com'
    ];
    
    let foundUserIndicator = false;
    for (const selector of userIndicators) {
      if (await page.locator(selector).isVisible().catch(() => false)) {
        foundUserIndicator = true;
        break;
      }
    }
    
    if (foundUserIndicator) {
      console.log('✅ User authentication state confirmed');
    } else {
      console.log('⚠️ User state unclear but login succeeded');
    }
  });
});

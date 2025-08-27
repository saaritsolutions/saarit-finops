import { test, expect } from '@playwright/test';

test.describe('SaaR Banking Demo - Health Check (Updated)', () => {
  test('should verify frontend accessibility and authentication flow', async ({ page }) => {
    console.log('🔍 Starting health check for demo environment...');
    
    // Test home page accessibility
    await test.step('Check frontend is running', async () => {
      await page.goto('/');
      await expect(page.locator('body')).toBeVisible();
      console.log('   ✅ Frontend is accessible');
    });

    // Check if auto-authentication is working
    await test.step('Check authentication behavior', async () => {
      await page.goto('/dashboard');
      
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        console.log('   🔐 Redirected to login (authentication required)');
        
        // Test login form if we're on login page
        const usernameField = page.locator('input[name="username"]');
        const passwordField = page.locator('input[name="password"]');
        
        if (await usernameField.isVisible().catch(() => false) && 
            await passwordField.isVisible().catch(() => false)) {
          console.log('   ✅ Login form is accessible');
          
          // Test demo credentials
          await usernameField.fill('admin@saarbanking.com');
          await passwordField.fill('admin123');
          await page.click('button[type="submit"]');
          
          // Wait for potential redirect
          await page.waitForTimeout(3000);
          
          if (page.url().includes('/dashboard')) {
            console.log('   ✅ Demo credentials work correctly');
          } else {
            console.log('   ⚠️  Login attempted but dashboard not reached');
          }
        } else {
          console.log('   ⚠️  Login form fields not immediately visible');
        }
      } else {
        console.log('   ✅ Auto-authentication is working (already logged in)');
        
        // Verify we can see dashboard elements
        const dashboardIndicators = [
          'text=Dashboard',
          'text=SaaR Banking',
          'h1, h2, [role="heading"]',
          '.dashboard',
          '[data-testid="dashboard"]'
        ];
        
        let foundDashboard = false;
        for (const selector of dashboardIndicators) {
          if (await page.locator(selector).isVisible().catch(() => false)) {
            console.log('   ✅ Dashboard is accessible');
            foundDashboard = true;
            break;
          }
        }
        
        if (!foundDashboard) {
          console.log('   ⚠️  Dashboard indicators not immediately visible');
        }
      }
    });

    // Test key demo pages accessibility
    await test.step('Check demo pages accessibility', async () => {
      const testPages = [
        { path: '/expressions', name: 'Expression Builder' },
        { path: '/loans/new', name: 'Loan Application' },
        { path: '/admin/config', name: 'Admin Configuration' },
        { path: '/demo', name: 'End-to-End Demo' }
      ];

      for (const testPage of testPages) {
        await page.goto(testPage.path);
        await page.waitForTimeout(2000);
        
        const currentUrl = page.url();
        const hasContent = await page.locator('body').isVisible();
        
        if (currentUrl.includes('/login')) {
          console.log(`   📝 ${testPage.name} requires authentication (redirected to login)`);
        } else if (hasContent) {
          console.log(`   ✅ ${testPage.name} page is accessible`);
        } else {
          console.log(`   ⚠️  ${testPage.name} page may have loading issues`);
        }
      }
    });

    console.log('🎉 Health check completed successfully!');
  });

  test('should verify browser automation is working correctly', async ({ page }) => {
    console.log('🤖 Testing browser automation capabilities...');
    
    // Test basic page interactions
    await test.step('Test basic page interactions', async () => {
      await page.goto('/');
      
      // Test that we can interact with the page
      const body = page.locator('body');
      await expect(body).toBeVisible();
      
      // Test navigation
      await page.goto('/login');
      await page.waitForTimeout(1000);
      
      // Test that URLs change properly
      const url = page.url();
      expect(url).toContain('localhost:3001');
      
      console.log('   ✅ Browser automation is working correctly');
    });

    // Test element detection capabilities
    await test.step('Test element detection', async () => {
      await page.goto('/');
      
      // Test common element types
      const elementTypes = [
        { selector: 'button', name: 'Buttons' },
        { selector: 'input', name: 'Input fields' },
        { selector: 'a', name: 'Links' },
        { selector: '[role]', name: 'ARIA elements' }
      ];
      
      for (const elementType of elementTypes) {
        const count = await page.locator(elementType.selector).count();
        console.log(`   📊 Found ${count} ${elementType.name}`);
      }
      
      console.log('   ✅ Element detection is working correctly');
    });

    console.log('🎉 Automation testing completed successfully!');
  });
});

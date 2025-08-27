import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Global test timeout - increased for complex scenarios */
  timeout: 120000, // 2 minutes per test
  /* Expected test timeout - for long-running demos */
  expect: {
    timeout: 15000, // 15 seconds for assertions
  },
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'reports/html-report' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['list']
  ],
  /* Output directory for test artifacts */
  outputDir: 'test-results',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3001',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video for all tests - especially for demo recordings */
    video: {
      mode: 'on',
      size: { width: 1920, height: 1080 }
    },
    
    /* Global timeout for each action - increased for demo scenarios */
    actionTimeout: 20000, // 20 seconds for actions
    
    /* Navigation timeout - for page loads */
    navigationTimeout: 30000, // 30 seconds for navigation
    
    /* Global timeout for navigation */
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'demo-full',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          slowMo: 1000, // Slow down for demo visibility
        }
      },
    },
    
    {
      name: 'demo-rehearsal',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          slowMo: 2000, // Extra slow for rehearsal
          headless: false, // Show browser during rehearsal
        }
      },
    },

    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Assuming services are already running on localhost:3001 */
  // No webServer configuration needed since services run independently
});

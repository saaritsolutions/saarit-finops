/// <reference types="cypress" />
export {};

/**
 * REGRESSION — Bank Configuration + Feature Toggles (SAAR-CFG-001)
 * Route:  /admin/bank-config  (requires SYSTEM_CONFIG permission)
 * Auth:   cy.loginAsDemo() for page tests (mock token → DEFAULT_FLAGS, all enabled)
 *         Fake real JWT (3-part token) for sidebar feature-gate tests
 *
 * API:  bankConfigService → REACT_APP_UAM_BASE_URL (default http://localhost:5033)
 *   GET /api/tenant-config → TenantConfig
 *   PUT /api/tenant-config → TenantConfig (Admin only)
 *
 * Sidebar feature gating:
 *   feature_gold_loan=false  → "Gold Loans" hidden
 *   feature_dynamic_forms=false → "Form Builder" hidden
 *   Bank Configuration always visible (no featureFlag)
 */

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_CONFIG = {
  name:                   'UCB Cooperative Bank',
  themeColor:             '#1565C0',
  logoUrl:                '',
  bankAddress:            '12 Gandhi Nagar, Pune 411001',
  bankPhone:              '+91-20-1234-5678',
  bankEmail:              'info@ucb-demo.com',
  rbiLicenseNumber:       'RBI/UCB/2019/0042',
  websiteUrl:             'https://ucb-demo.example.com',
  featureGoldLoan:        true,
  featureDynamicForms:    true,
  featureExpressions:     true,
  featureApprovalChain:   true,
  featureComplianceAlerts: false,
  featureFdRd:            true,
  configUpdatedAt:        null,
  configUpdatedBy:        null,
};

// ── Fake JWT helper (sidebar gating tests) ────────────────────────────────────
// Must be called inside beforeEach/it (browser context, btoa available)

function makeFakeJwt(overrides: Record<string, string> = {}): string {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub:        '1',
    email:      'admin@ucb-demo.com',
    name:       'admin',
    tenant_id:  'ucb_demo',
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Admin',
    feature_gold_loan:         'true',
    feature_dynamic_forms:     'true',
    feature_expressions:       'true',
    feature_approval_chain:    'true',
    feature_compliance_alerts: 'false',
    feature_fd_rd:             'true',
    ...overrides,
    exp: 9999999999,
  }));
  return `${header}.${payload}.fakesig`;
}

// ── Suite 1: Bank Profile Tab ─────────────────────────────────────────────────

describe('[REGRESSION] Bank Configuration — Bank Profile Tab', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/tenant-config*', { body: MOCK_CONFIG }).as('getConfig');
    cy.loginAsDemo();
    cy.visit('/admin/bank-config');
    cy.wait('@getConfig');
  });

  it('loads the Bank Configuration page with Bank Profile tab active', () => {
    cy.contains('Bank Configuration').should('be.visible');
    cy.contains('[role="tab"]', /Bank Profile/i).should('be.visible');
    cy.contains('[role="tab"]', /Feature Toggles/i).should('be.visible');
  });

  it('populates Bank Name field from mock config', () => {
    cy.get('[aria-label="Bank Name"]')
      .should('have.value', 'UCB Cooperative Bank');
  });

  it('allows editing the Bank Name field', () => {
    cy.get('[aria-label="Bank Name"]')
      .clear()
      .type('New Bank Name');
    cy.get('[aria-label="Bank Name"]').should('have.value', 'New Bank Name');
  });

  it('shows success alert after saving bank profile', () => {
    cy.intercept('PUT', '**/api/tenant-config*', { statusCode: 200, body: MOCK_CONFIG }).as('putConfig');
    cy.get('[aria-label="Save bank configuration"]').click();
    cy.wait('@putConfig');
    cy.contains(/saved successfully/i).should('be.visible');
  });

  it('shows error alert when save fails', () => {
    cy.intercept('PUT', '**/api/tenant-config*', {
      statusCode: 403,
      body: { error: 'Not authorized to modify configuration' },
    }).as('putFail');
    cy.get('[aria-label="Save bank configuration"]').click();
    cy.wait('@putFail');
    cy.contains(/not authorized|save failed/i).should('be.visible');
  });
});

// ── Suite 2: Feature Toggles Tab ─────────────────────────────────────────────

describe('[REGRESSION] Bank Configuration — Feature Toggles Tab', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/tenant-config*', { body: MOCK_CONFIG }).as('getConfig');
    cy.loginAsDemo();
    cy.visit('/admin/bank-config');
    cy.wait('@getConfig');
    cy.contains('[role="tab"]', /Feature Toggles/i).click();
  });

  it('renders the Feature Toggles tab content', () => {
    cy.get('[aria-label="Toggle Gold Loan"]').should('exist');
    cy.get('[aria-label="Toggle Dynamic Forms"]').should('exist');
    cy.get('[aria-label="Toggle Expression Builder"]').should('exist');
  });

  it('Gold Loan toggle is ON when featureGoldLoan=true in config', () => {
    cy.get('[aria-label="Toggle Gold Loan"]').should('be.checked');
  });

  it('toggling Gold Loan OFF updates the switch state', () => {
    cy.get('[aria-label="Toggle Gold Loan"]').should('be.checked');
    cy.get('[aria-label="Toggle Gold Loan"]').click({ force: true });
    cy.get('[aria-label="Toggle Gold Loan"]').should('not.be.checked');
  });

  it('shows info alert about re-login requirement', () => {
    cy.contains(/take effect at next login/i).should('be.visible');
  });

  it('saves feature toggles and shows success', () => {
    cy.intercept('PUT', '**/api/tenant-config*', {
      statusCode: 200,
      body: { ...MOCK_CONFIG, featureGoldLoan: false },
    }).as('putConfig');
    cy.get('[aria-label="Save bank configuration"]').click();
    cy.wait('@putConfig');
    cy.contains(/saved successfully/i).should('be.visible');
  });
});

// ── Suite 3: Sidebar Feature Gating ──────────────────────────────────────────

describe('[REGRESSION] Sidebar Feature Gating', () => {
  it('hides Gold Loans section in sidebar when feature_gold_loan=false', () => {
    const token = makeFakeJwt({ feature_gold_loan: 'false' });
    cy.visit('/dashboard', {
      onBeforeLoad(win: Window & typeof globalThis) {
        win.localStorage.setItem('auth-token', token);
      },
    });
    cy.get('nav').should('not.contain', 'Gold Loans');
  });

  it('shows Gold Loans section in sidebar when feature_gold_loan=true', () => {
    const token = makeFakeJwt({ feature_gold_loan: 'true' });
    cy.visit('/dashboard', {
      onBeforeLoad(win: Window & typeof globalThis) {
        win.localStorage.setItem('auth-token', token);
      },
    });
    cy.get('nav').should('contain', 'Gold Loans');
  });

  it('hides Form Builder in sidebar when feature_dynamic_forms=false', () => {
    const token = makeFakeJwt({ feature_dynamic_forms: 'false' });
    cy.visit('/dashboard', {
      onBeforeLoad(win: Window & typeof globalThis) {
        win.localStorage.setItem('auth-token', token);
      },
    });
    cy.get('nav').should('not.contain', 'Form Builder');
  });

  it('shows Form Builder in sidebar when feature_dynamic_forms=true', () => {
    const token = makeFakeJwt({ feature_dynamic_forms: 'true' });
    cy.visit('/dashboard', {
      onBeforeLoad(win: Window & typeof globalThis) {
        win.localStorage.setItem('auth-token', token);
      },
    });
    cy.get('nav').should('contain', 'Form Builder');
  });

  it('Bank Configuration entry always visible in sidebar', () => {
    cy.loginAsDemo();
    cy.visit('/dashboard');
    cy.get('nav').should('contain', 'Bank Configuration');
  });
});

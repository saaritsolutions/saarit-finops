/// <reference types="cypress" />
export {};

/**
 * REGRESSION — Form Builder Module (SAAR-DFS-002)
 * Route: /admin/form-builder  (requires SYSTEM_CONFIG permission)
 * Auth:  cy.loginAsDemo() sets a mock-jwt-token-* which grants all permissions
 *        including 'system.config' via the isMockToken path in authSlice.
 *
 * API: dynamicFormsService → http://localhost:5013/api/forms
 *   GET /api/forms               → FormSchemaListItem[]
 *   GET /api/forms/{type}        → FormSchemaResponse { ..., schema: JSON string }
 *   GET /api/forms/{type}/history→ FormSchemaHistoryItem[]
 *   PUT /api/forms/{type}        → FormSchemaResponse (create new version)
 *   POST /api/forms/{type}/reset → 200 (delete tenant override)
 *
 * Tabs: Schemas (0) | Field Editor (1, disabled until loaded) | Preview (2, disabled) | History (3)
 * Action buttons use aria-label for testability (MUI v7 Tooltip doesn't set DOM title).
 */

// ── Mock data ─────────────────────────────────────────────────────────────────

const SCHEMAS = [
  { formType: 'PERSONAL_LOAN',      tenantId: 'public', version: 1, isActive: true, isDefault: true,  updatedAt: '2026-04-01T00:00:00Z', updatedBy: 'system' },
  { formType: 'GOLD_LOAN',          tenantId: 'public', version: 1, isActive: true, isDefault: true,  updatedAt: '2026-04-01T00:00:00Z', updatedBy: 'system' },
  { formType: 'ACCOUNT_OPENING_SB', tenantId: 'public', version: 1, isActive: true, isDefault: true,  updatedAt: '2026-04-01T00:00:00Z', updatedBy: 'system' },
  { formType: 'ACCOUNT_OPENING_FD', tenantId: 'public', version: 1, isActive: true, isDefault: true,  updatedAt: '2026-04-01T00:00:00Z', updatedBy: 'system' },
  { formType: 'KYC_INDIVIDUAL',     tenantId: 'public', version: 1, isActive: true, isDefault: true,  updatedAt: '2026-04-01T00:00:00Z', updatedBy: 'system' },
];

const PERSONAL_LOAN_SCHEMA_OBJ = {
  title: 'Personal Loan Application',
  fields: [
    { name: 'fullName',         label: 'Full Name',           type: 'text',   required: true, section: 'applicant_details', maxLength: 100 },
    { name: 'dateOfBirth',      label: 'Date of Birth',       type: 'date',   required: true, section: 'applicant_details' },
    { name: 'panNumber',        label: 'PAN Number',          type: 'text',   required: true, section: 'applicant_details', maxLength: 10 },
    { name: 'monthlyIncome',    label: 'Monthly Income',      type: 'number', required: true, section: 'employment_income', min: 0 },
    { name: 'loanAmount',       label: 'Loan Amount',         type: 'number', required: true, section: 'loan_details',      min: 10000 },
    { name: 'loanTenureMonths', label: 'Loan Tenure (months)', type: 'number', required: true, section: 'loan_details',     min: 6, max: 360 },
  ],
  sections: [
    { key: 'applicant_details', title: 'Applicant Details',   fields: ['fullName', 'dateOfBirth', 'panNumber'] },
    { key: 'employment_income', title: 'Employment & Income', fields: ['monthlyIncome'] },
    { key: 'loan_details',      title: 'Loan Details',        fields: ['loanAmount', 'loanTenureMonths'] },
  ],
};

const SCHEMA_RESPONSE = {
  formType:  'PERSONAL_LOAN',
  tenantId:  'public',
  version:   1,
  isDefault: true,
  updatedAt: '2026-04-01T00:00:00Z',
  updatedBy: 'system',
  schema:    JSON.stringify(PERSONAL_LOAN_SCHEMA_OBJ),
};

const SAVED_RESPONSE = { ...SCHEMA_RESPONSE, version: 2 };

const HISTORY = [
  {
    version:    1,
    savedBy:    'system',
    savedAt:    '2026-04-01T00:00:00Z',
    notes:      'Seed',
    schemaJson: JSON.stringify(PERSONAL_LOAN_SCHEMA_OBJ),
  },
];

// ── Intercept helper ──────────────────────────────────────────────────────────
// Single route function dispatches by URL shape to avoid ordering issues.
// History URLs contain "/history"; schema-get URLs end with the type name;
// list URL ends at /api/forms (no further path).

function stubFormsApi() {
  cy.intercept('GET', /\/api\/forms/i, (req) => {
    if (/\/history/.test(req.url)) {
      req.reply({ body: HISTORY });
    } else if (/\/api\/forms\/[^/]+/.test(req.url)) {
      req.reply({ body: SCHEMA_RESPONSE });
    } else {
      req.reply({ body: SCHEMAS });
    }
  }).as('formsApi');

  cy.intercept('PUT', /\/api\/forms/i, { body: SAVED_RESPONSE }).as('saveSchema');
  cy.intercept('POST', /\/api\/forms.*reset/i, { statusCode: 200 }).as('resetSchema');
}

// ── Schemas Tab ───────────────────────────────────────────────────────────────

describe('[REGRESSION] Form Builder — Schemas Tab', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    stubFormsApi();
  });

  it('loads the Form Builder page with correct heading', () => {
    cy.visit('/admin/form-builder');
    cy.contains(/form builder/i, { timeout: 15000 }).should('be.visible');
  });

  it('shows four tabs: Schemas, Field Editor, Preview, History', () => {
    cy.visit('/admin/form-builder');
    cy.contains('[role="tab"]', /^schemas$/i, { timeout: 10000 }).should('exist');
    cy.contains('[role="tab"]', /field editor/i).should('exist');
    cy.contains('[role="tab"]', /^preview$/i).should('exist');
    cy.contains('[role="tab"]', /^history$/i).should('exist');
  });

  it('Schemas tab is selected by default', () => {
    cy.visit('/admin/form-builder');
    cy.contains('[role="tab"][aria-selected="true"]', /^schemas$/i, { timeout: 10000 }).should('exist');
  });

  it('shows table column headers', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.contains(/form type/i, { timeout: 10000 }).should('exist');
    cy.contains(/version/i).should('exist');
    cy.contains(/actions/i).should('exist');
  });

  it('lists all 5 seed schemas', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.contains('PERSONAL_LOAN', { timeout: 10000 }).should('exist');
    cy.contains('GOLD_LOAN').should('exist');
    cy.contains('KYC_INDIVIDUAL').should('exist');
    cy.contains('ACCOUNT_OPENING_SB').should('exist');
    cy.contains('ACCOUNT_OPENING_FD').should('exist');
  });

  it('shows version chip v1 for each schema', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    // Multiple v1 chips (one per schema row)
    cy.contains('v1', { timeout: 10000 }).should('exist');
  });

  it('shows Active chip for active schemas', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.contains('Active', { timeout: 10000 }).should('exist');
  });

  it('shows Default chip for seed schemas', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.contains('Default', { timeout: 10000 }).should('exist');
  });

  it('Edit action button has aria-label on each row', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="Edit PERSONAL_LOAN"]', { timeout: 10000 }).should('exist');
    cy.get('[aria-label="Edit GOLD_LOAN"]').should('exist');
  });

  it('History action button has aria-label on each row', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="History PERSONAL_LOAN"]', { timeout: 10000 }).should('exist');
  });
});

// ── Field Editor Tab ──────────────────────────────────────────────────────────

describe('[REGRESSION] Form Builder — Field Editor Tab', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    stubFormsApi();
  });

  it('clicking Edit switches to Field Editor tab', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="Edit PERSONAL_LOAN"]', { timeout: 10000 }).click();
    // loadIntoEditor calls setActiveTab(1) — Field Editor becomes active
    cy.contains('[role="tab"][aria-selected="true"]', /field editor/i, { timeout: 10000 }).should('exist');
  });

  it('Field Editor shows section accordions for PERSONAL_LOAN', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="Edit PERSONAL_LOAN"]', { timeout: 10000 }).click();
    cy.contains(/applicant details/i, { timeout: 10000 }).should('exist');
    cy.contains(/employment.*income/i).should('exist');
    cy.contains(/loan details/i).should('exist');
  });

  it('Field Editor shows field labels inside sections', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="Edit PERSONAL_LOAN"]', { timeout: 10000 }).click();
    cy.contains(/full name/i, { timeout: 10000 }).should('exist');
    cy.contains(/loan amount/i).should('exist');
    cy.contains(/monthly income/i).should('exist');
  });

  it('Save button is visible and enabled', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="Edit PERSONAL_LOAN"]', { timeout: 10000 }).click();
    cy.get('[aria-label="Save schema"]', { timeout: 10000 })
      .should('be.visible')
      .and('not.be.disabled');
  });

  it('Version Notes input is present', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="Edit PERSONAL_LOAN"]', { timeout: 10000 }).click();
    cy.contains(/version notes/i, { timeout: 10000 }).should('exist');
  });

  it('clicking Save sends PUT request and shows Saved v2 chip', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="Edit PERSONAL_LOAN"]', { timeout: 10000 }).click();
    cy.get('[aria-label="Save schema"]', { timeout: 10000 }).click();
    cy.wait('@saveSchema', { timeout: 10000 });
    cy.contains(/saved v2/i, { timeout: 10000 }).should('exist');
  });

  it('Form Type dropdown shows loaded schema type', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="Edit PERSONAL_LOAN"]', { timeout: 10000 }).click();
    // Dropdown in action bar shows the current form type
    cy.contains('PERSONAL_LOAN', { timeout: 10000 }).should('exist');
  });
});

// ── History Tab ───────────────────────────────────────────────────────────────

describe('[REGRESSION] Form Builder — History Tab', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    stubFormsApi();
  });

  it('clicking History action switches to History tab', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="History PERSONAL_LOAN"]', { timeout: 10000 }).click();
    // openHistory sets activeTab(3) — History becomes active
    cy.contains('[role="tab"][aria-selected="true"]', /^history$/i, { timeout: 10000 }).should('exist');
  });

  it('History tab shows table column headers', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="History PERSONAL_LOAN"]', { timeout: 10000 }).click();
    cy.contains(/version/i, { timeout: 10000 }).should('exist');
    cy.contains(/saved by/i).should('exist');
    cy.contains(/notes/i).should('exist');
  });

  it('History tab shows history rows from API', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="History PERSONAL_LOAN"]', { timeout: 10000 }).click();
    // HISTORY mock has 1 row: savedBy "system", notes "Seed"
    cy.contains('system', { timeout: 15000 }).should('exist');
    cy.contains('Seed').should('exist');
  });

  it('History tab shows View JSON button for each row', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="History PERSONAL_LOAN"]', { timeout: 10000 }).click();
    cy.get('[aria-label="View JSON v1"]', { timeout: 15000 }).should('exist');
  });

  it('clicking View JSON opens a dialog with schema JSON', () => {
    cy.visit('/admin/form-builder');
    cy.wait('@formsApi', { timeout: 15000 });
    cy.get('[aria-label="History PERSONAL_LOAN"]', { timeout: 10000 }).click();
    cy.get('[aria-label="View JSON v1"]', { timeout: 15000 }).click();
    // Dialog title: "Schema JSON — v1"
    cy.contains(/schema json.*v1/i, { timeout: 10000 }).should('be.visible');
    // Dialog body contains the JSON (pre block)
    cy.contains(/Personal Loan Application/i, { timeout: 5000 }).should('exist');
  });
});

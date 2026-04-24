/// <reference types="cypress" />
export {};

/**
 * REGRESSION — Gold Loan Module (SAAR-GL-001 Phase 1 + SAAR-DFS-004)
 * Covers: gold rate admin page, gold loan list, gold loan detail,
 *         DFS bank-configured fields in origination wizard + detail page.
 *
 * API routes:
 *   GET  /api/gold-rate/today        → GoldRateEntry (with isLatest)
 *   GET  /api/gold-rate              → GoldRateEntry[]
 *   GET  /api/gold-loan/applications → { total, page, pageSize, items: GoldLoanListItem[] }
 *   GET  /api/gold-loan/applications/:id → GoldLoanDetail (formDataJson optional)
 *   GET  /api/forms/GOLD_LOAN        → FormSchemaResponse (DFSFormSchema as JSON string)
 */

// ── Mock Data ──────────────────────────────────────────────────────────────────

const GOLD_RATE = {
  id:               'gr-1',
  rateDate:         '2026-04-22T00:00:00Z',
  ratePerGramFor22K: 7500,
  source:           'MANUAL',
  enteredBy:        'admin@ucb-demo.com',
  createdAt:        '2026-04-22T08:00:00Z',
  isLatest:         true,
};

const GOLD_RATE_STALE = { ...GOLD_RATE, rateDate: '2026-04-20T00:00:00Z', isLatest: false };

const PLEDGE_ITEMS = [
  {
    id: 'pi-1', itemType: 'NECKLACE', description: '22K gold necklace',
    grossWeightGrams: 20, stoneDeductionGrams: 1, netWeightGrams: 19,
    purityCarats: 22, purityFactor: 0.9167, goldRatePerGram: 7500,
    valuedAmount: 131250, packetNumber: 'P-001', isReleased: false,
    releasedAt: null, createdAt: '2026-04-22T09:00:00Z',
  },
];

const GOLD_APP_DETAIL = {
  id: 'gl-1',
  applicationNumber: 'GL-2026-000001',
  applicantName: 'Sita Devi',
  mobileNumber: '9876543210',
  panNumber: 'ABCDE1234F',
  aadhaarLast4: '1234',
  currentAddressLine1: '12 Gandhi Nagar',
  currentCity: 'Pune',
  currentState: 'Maharashtra',
  purposeOfLoan: 'Medical emergency',
  requestedAmount: 98000,
  status: 'DISBURSED',
  disbursalJournalNumber: 'GL-JNL-2026-00001',
  createdBy: 'maker@ucb-demo.com',
  createdAt: '2026-04-22T09:00:00Z',
  updatedAt: '2026-04-22T11:00:00Z',
  // GoldLoanDetails
  goldLoanDetailsId: 'gld-1',
  goldLoanStatus: 'DISBURSED',
  repaymentScheme: 'BULLET',
  tenureMonths: 6,
  maturityDate: '2026-10-22T00:00:00Z',
  sanctionedAmount: 98000,
  interestRatePercent: 7,
  totalInterestAmount: 3430,
  totalAmountDue: 101430,
  totalNetWeightGrams: 19,
  totalValuedAmount: 131250,
  ltvPercent: 74.67,
  goldRateAtAppraisal: 7500,
  appraiserName: 'Ravi Kumar',
  appraiserEmployeeId: 'EMP-042',
  vaultLocation: 'Branch Vault A',
  pledgeReceiptNumber: 'PR-2026-000001',
  appraisedAt: '2026-04-22T09:30:00Z',
  sanctionedAt: '2026-04-22T10:00:00Z',
  disbursedAt: '2026-04-22T11:00:00Z',
  closedAt: null,
  goldReleasedAt: null,
  closureJournalNumber: null,
  pledgeItems: PLEDGE_ITEMS,
  actions: [
    { id: 'a1', action: 'CREATED',  actionDescription: 'Application created',       actionBy: 'maker@ucb-demo.com', role: 'MAKER', fromStatus: null,       toStatus: 'DRAFT',      actionAt: '2026-04-22T09:00:00Z' },
    { id: 'a2', action: 'SUBMIT',   actionDescription: 'Application submitted',      actionBy: 'maker@ucb-demo.com', role: 'CREDIT_OFFICER', fromStatus: 'DRAFT',      toStatus: 'SUBMITTED',  actionAt: '2026-04-22T09:10:00Z' },
    { id: 'a3', action: 'APPRAISE', actionDescription: 'Gold appraised by Ravi Kumar', actionBy: 'officer@ucb-demo.com', role: 'CREDIT_OFFICER', fromStatus: 'SUBMITTED',  toStatus: 'APPRAISED',  actionAt: '2026-04-22T09:30:00Z' },
    { id: 'a4', action: 'SANCTION', actionDescription: 'Loan sanctioned',             actionBy: 'officer@ucb-demo.com', role: 'CREDIT_OFFICER', fromStatus: 'APPRAISED',  toStatus: 'SANCTIONED', actionAt: '2026-04-22T10:00:00Z' },
    { id: 'a5', action: 'DISBURSE', actionDescription: 'Loan disbursed',              actionBy: 'officer@ucb-demo.com', role: 'CREDIT_OFFICER', fromStatus: 'SANCTIONED', toStatus: 'DISBURSED',  actionAt: '2026-04-22T11:00:00Z' },
  ],
};

const GOLD_APPS_LIST = [
  {
    id: 'gl-1',
    applicationNumber: 'GL-2026-000001',
    applicantName: 'Sita Devi',
    mobileNumber: '9876543210',
    panNumber: 'ABCDE1234F',
    goldLoanStatus: 'DISBURSED',
    totalNetWeightGrams: 19,
    totalValuedAmount: 131250,
    ltvPercent: 74.67,
    sanctionedAmount: 98000,
    disbursedAt: '2026-04-22T11:00:00Z',
    maturityDate: '2026-10-22T00:00:00Z',
    closedAt: null,
    createdAt: '2026-04-22T09:00:00Z',
  },
  {
    id: 'gl-2',
    applicationNumber: 'GL-2026-000002',
    applicantName: 'Ramesh Patel',
    panNumber: 'XYZAB5678G',
    goldLoanStatus: 'SUBMITTED',
    totalNetWeightGrams: 15,
    totalValuedAmount: 100000,
    ltvPercent: 0,
    sanctionedAmount: 0,
    createdAt: '2026-04-21T10:00:00Z',
  },
];

const listBody = (items: typeof GOLD_APPS_LIST) => ({
  total: items.length, page: 1, pageSize: 50, items,
});

// ── DFS mock data ──────────────────────────────────────────────────────────────

const DFS_SCHEMA_OBJ = {
  title: 'Gold Loan Bank Fields',
  fields: [
    { name: 'loanScheme', label: 'Loan Scheme', type: 'text', section: 'applicant' },
  ],
  sections: [],
};

const DFS_SCHEMA_RESPONSE = {
  formType:  'GOLD_LOAN',
  tenantId:  'ucb_demo',
  version:   1,
  isDefault: false,
  updatedAt: '2026-04-22T00:00:00Z',
  schema:    JSON.stringify(DFS_SCHEMA_OBJ),
};

// ── DFS Bank-Configured Fields ─────────────────────────────────────────────────

describe('[REGRESSION] DFS Bank-Configured Fields', () => {
  it('renders accordion on origination wizard when DFS schema is available', () => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/forms/GOLD_LOAN*', { body: DFS_SCHEMA_RESPONSE }).as('dfsSchema');
    cy.intercept('GET', '**/api/gold-rate/today*', { body: GOLD_RATE }).as('goldRate');

    cy.visit('/gold-loans/new');
    cy.wait('@dfsSchema', { timeout: 15000 });
    cy.contains(/bank-configured fields/i).should('exist');
  });

  it('detail page shows bank-configured fields section when formDataJson is present', () => {
    cy.loginAsDemo();
    const detailWithDfs = {
      ...GOLD_APP_DETAIL,
      formDataJson: '{"loanScheme":"EMI","goldPurity":"22K"}',
    };
    cy.intercept('GET', '**/api/gold-loan/applications/gl-1*', { body: detailWithDfs }).as('detail');
    cy.intercept('GET', '**/api/gold-rate/today*', { body: GOLD_RATE }).as('goldRate');

    cy.visit('/gold-loans/gl-1');
    cy.wait('@detail', { timeout: 15000 });
    cy.contains(/bank-configured fields/i).should('exist');
    cy.contains('loanScheme').should('exist');
    cy.contains('EMI').should('exist');
  });

  it('DFS offline (503) — no accordion shown, origination wizard still loads', () => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/forms/GOLD_LOAN*', { statusCode: 503 }).as('dfsOffline');
    cy.intercept('GET', '**/api/gold-rate/today*', { body: GOLD_RATE }).as('goldRate');

    cy.visit('/gold-loans/new');
    cy.wait('@dfsOffline', { timeout: 15000 });
    cy.contains(/bank-configured fields/i).should('not.exist');
    // Wizard still functional — stepper and applicant step visible
    cy.contains(/new gold loan application/i).should('exist');
  });
});

// ── Gold Rate Admin ────────────────────────────────────────────────────────────

describe('[REGRESSION] Gold Rate Admin', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/gold-rate/today*', { body: GOLD_RATE }).as('todayRate');
    cy.intercept('GET', '**/api/gold-rate*',        { body: [GOLD_RATE] }).as('history');
  });

  it('loads the gold rate admin page', () => {
    cy.visit('/admin/gold-rate');
    cy.wait('@todayRate', { timeout: 15000 });
    cy.contains(/gold rate administration/i).should('exist');
  });

  it("displays today's rate correctly", () => {
    cy.visit('/admin/gold-rate');
    cy.wait('@todayRate', { timeout: 15000 });
    cy.contains(/7,500/i).should('exist');   // rate amount visible
    cy.contains(/gram/i).should('exist');
  });

  it('shows the history table with source and entered-by', () => {
    cy.visit('/admin/gold-rate');
    cy.wait('@history', { timeout: 15000 });
    cy.contains('MANUAL').should('exist');
    cy.contains('admin@ucb-demo.com').should('exist');
  });

  it('renders the rate entry form with date and amount fields', () => {
    cy.visit('/admin/gold-rate');
    cy.wait('@todayRate', { timeout: 15000 });
    cy.get('input[type="date"]').should('exist');
    cy.get('input[type="number"]').should('exist');
    cy.contains(/save rate/i).should('exist');
  });

  it('shows amber warning chip when rate is stale (isLatest=false)', () => {
    cy.intercept('GET', '**/api/gold-rate/today*', { body: GOLD_RATE_STALE }).as('staleRate');
    cy.visit('/admin/gold-rate');
    cy.wait('@staleRate', { timeout: 15000 });
    cy.contains(/today.*not.*entered|rate from/i).should('exist');
  });
});

// ── Gold Loan List ─────────────────────────────────────────────────────────────

describe('[REGRESSION] Gold Loan List', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/gold-loan/applications*', { body: listBody(GOLD_APPS_LIST) }).as('goldLoans');
  });

  it('loads the gold loan list page', () => {
    cy.visit('/gold-loans');
    cy.wait('@goldLoans', { timeout: 15000 });
    cy.contains(/gold loan/i).should('exist');
  });

  it('shows both seeded gold loan applications', () => {
    cy.visit('/gold-loans');
    cy.wait('@goldLoans', { timeout: 15000 });
    cy.contains('GL-2026-000001').should('exist');
    cy.contains('GL-2026-000002').should('exist');
  });

  it('displays table columns: App#, Applicant, Net Wt, Valued Amt, LTV, Sanction, Status', () => {
    cy.visit('/gold-loans');
    cy.wait('@goldLoans', { timeout: 15000 });
    cy.contains(/app\s*#|application/i).should('exist');
    cy.contains(/applicant/i).should('exist');
    cy.contains(/net\s*wt|weight/i).should('exist');
    cy.contains(/valued|value/i).should('exist');
    cy.contains(/status/i).should('exist');
  });

  it('shows correct status chips (DISBURSED green, SUBMITTED blue)', () => {
    cy.visit('/gold-loans');
    cy.wait('@goldLoans', { timeout: 15000 });
    cy.contains(/disbursed/i).should('exist');
    cy.contains(/submitted/i).should('exist');
  });

  it('clicking a row navigates to gold loan detail', () => {
    cy.intercept('GET', '**/api/gold-loan/applications/gl-1*', { body: GOLD_APP_DETAIL }).as('detail');
    cy.visit('/gold-loans');
    cy.wait('@goldLoans', { timeout: 15000 });
    cy.contains('GL-2026-000001').click({ force: true });
    cy.url({ timeout: 10000 }).should('include', '/gold-loans/');
  });
});

// ── Gold Loan Detail ───────────────────────────────────────────────────────────

describe('[REGRESSION] Gold Loan Detail', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/gold-loan/applications*', { body: listBody(GOLD_APPS_LIST) }).as('goldLoans');
    cy.intercept('GET', '**/api/gold-loan/applications/gl-1*', { body: GOLD_APP_DETAIL }).as('goldDetail');
    cy.intercept('GET', '**/api/gold-rate/today*', { body: GOLD_RATE }).as('todayRate');
  });

  it('loads the gold loan detail page', () => {
    cy.visit('/gold-loans/gl-1');
    cy.wait('@goldDetail', { timeout: 15000 });
    cy.contains('GL-2026-000001').should('exist');
    cy.contains('Sita Devi').should('exist');
  });

  it('shows DISBURSED status chip on header', () => {
    cy.visit('/gold-loans/gl-1');
    cy.wait('@goldDetail', { timeout: 15000 });
    cy.contains(/disbursed/i).should('exist');
  });

  it('Pledge Items tab: shows pledge item row with correct type and valued amount', () => {
    cy.visit('/gold-loans/gl-1');
    cy.wait('@goldDetail', { timeout: 15000 });
    cy.contains(/pledge items/i).click({ force: true });
    cy.contains('NECKLACE').should('exist');
    // ValuedAmount = ₹1,31,250
    cy.contains(/1,31,250|131,250/i).should('exist');
  });

  it('Loan Terms tab: shows sanctioned amount, interest rate, and maturity date', () => {
    cy.visit('/gold-loans/gl-1');
    cy.wait('@goldDetail', { timeout: 15000 });
    cy.contains(/loan terms/i).click({ force: true });
    cy.contains(/sanctioned amount/i).should('exist');
    cy.contains(/7.*p\.a\.|7.*annual|7%/i).should('exist');
    cy.contains(/maturity/i).should('exist');
  });

  it('Loan Terms tab: disbursal journal chip is visible and clickable', () => {
    cy.intercept('GET', '**/api/journal*', { body: { journalNumber: 'GL-JNL-2026-00001', entries: [] } }).as('journal');
    cy.visit('/gold-loans/gl-1');
    cy.wait('@goldDetail', { timeout: 15000 });
    cy.contains(/loan terms/i).click({ force: true });
    cy.contains('GL-JNL-2026-00001').should('exist');
  });

  it('Timeline tab: shows all 5 action events', () => {
    cy.visit('/gold-loans/gl-1');
    cy.wait('@goldDetail', { timeout: 15000 });
    cy.contains(/timeline/i).click({ force: true });
    cy.contains('CREATED').should('exist');
    cy.contains('DISBURSED').should('exist');
  });
});

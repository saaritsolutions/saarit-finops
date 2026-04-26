/// <reference types="cypress" />
export {};

/**
 * REGRESSION — MIS Reports & Compliance Dashboard (SAAR-RPT-001)
 * Routes:
 *   /reports         → Financial Reports tab (Tab 0, default)
 *   /reports/financial → Financial Reports tab
 *   /reports/regulatory → Compliance Alerts tab (Tab 1)
 *
 * APIs mocked:
 *   GET **/api/ledger/balances         → BALANCES
 *   GET **/api/journal/daily-summary** → DAILY_SUMMARY
 *   GET **/api/compliance/alerts**     → COMPLIANCE_ALERTS / COMPLIANCE_ALERTS_EMPTY
 *   GET **/api/account/upcoming-maturities** → MATURITIES / MATURITIES_EMPTY
 */

// ── Mock Data ─────────────────────────────────────────────────────────────────

const BALANCES = [
  {
    accountCode:   '1010',
    accountName:   'Cash and Bank',
    debitTotal:    5000000,
    creditTotal:   2000000,
    normalBalance: 'Debit',
    lastUpdatedAt: '2026-04-24T10:00:00Z',
  },
  {
    accountCode:   '2010',
    accountName:   'Fixed Deposits Liability',
    debitTotal:    0,
    creditTotal:   8000000,
    normalBalance: 'Credit',
    lastUpdatedAt: '2026-04-24T10:00:00Z',
  },
];

const DAILY_SUMMARY = {
  from: '2026-03-26',
  to:   '2026-04-25',
  days: [
    { date: '2026-04-23T00:00:00', journalCount: 3, totalDebit: 900000,  totalCredit: 900000  },
    { date: '2026-04-24T00:00:00', journalCount: 2, totalDebit: 500000,  totalCredit: 500000  },
  ],
  grandTotalCount:  5,
  grandTotalDebit:  1400000,
  grandTotalCredit: 1400000,
};

const COMPLIANCE_ALERTS = {
  total:    1,
  page:     1,
  pageSize: 20,
  items: [
    {
      id:            'alert-001',
      alertType:     'CTR',
      journalNumber: 'JNL-20260424-000001',
      referenceId:   'GL-2026-000001',
      triggerAmount: 1200000,
      status:        'PENDING',
      reviewedBy:    null,
      reviewedAt:    null,
      reviewNotes:   null,
      createdAt:     '2026-04-24T12:00:00Z',
    },
  ],
};

const COMPLIANCE_ALERTS_EMPTY = { total: 0, page: 1, pageSize: 20, items: [] };

const MATURITIES = [
  {
    accountId:         'acc-fd-001',
    accountNumber:     'FD-2026-000001',
    customerId:        'CUST-001',
    productType:       'FixedDeposit',
    principal:         100000,
    annualRate:        7.5,
    termMonths:        12,
    maturityDate:      '2026-04-30',
    daysToMaturity:    5,
    projectedInterest: 7500,
    projectedPayout:   107500,
    autoRenewal:       false,
  },
];

const MATURITIES_EMPTY: never[] = [];

// ── Helper: stub all Reports APIs ─────────────────────────────────────────────

function stubReportApis(opts: {
  alerts?: object;
  maturities?: unknown[];
} = {}) {
  cy.intercept('GET', '**/api/ledger/balances*', { body: BALANCES }).as('getBalances');
  cy.intercept('GET', '**/api/journal/daily-summary*', { body: DAILY_SUMMARY }).as('getDailySummary');
  cy.intercept('GET', '**/api/compliance/alerts*', { body: opts.alerts ?? COMPLIANCE_ALERTS }).as('getAlerts');
  cy.intercept('GET', '**/api/account/upcoming-maturities*', { body: opts.maturities ?? MATURITIES }).as('getMaturities');
}

// ── Suite 1: Financial Reports Tab ────────────────────────────────────────────

describe('[REGRESSION] Reports — Financial Reports Tab', () => {
  beforeEach(() => {
    stubReportApis();
    cy.loginAsDemo();
    cy.visit('/reports/financial');
  });

  it('renders the Reports & MIS page with Financial Reports tab active', () => {
    cy.contains('Reports & MIS').should('be.visible');
    cy.contains('[role="tab"]', /Financial Reports/i).should('be.visible');
    cy.contains('[role="tab"]', /Compliance Alerts/i).should('be.visible');
    cy.contains('[role="tab"]', /Deposit Maturity/i).should('be.visible');
  });

  it('renders GL balance table with account rows', () => {
    cy.wait('@getBalances');
    cy.contains('GL Account Balances').should('be.visible');
    cy.contains('1010').should('be.visible');
    cy.contains('Cash and Bank').should('be.visible');
    cy.contains('2010').should('be.visible');
    cy.contains('Fixed Deposits Liability').should('be.visible');
  });

  it('renders the daily transaction bar chart when summary loads', () => {
    cy.wait('@getDailySummary');
    cy.contains('Daily Transaction Volume').should('be.visible');
    // Recharts renders a .recharts-bar-rectangle element
    cy.get('.recharts-bar').should('exist');
    cy.contains('Grand Total').should('not.exist');  // no "Grand Total" label — check totals section
    cy.contains('Total Journals').should('be.visible');
    cy.contains('5').should('be.visible');  // grandTotalCount
  });

  it('shows Export CSV button in the financial tab', () => {
    cy.wait('@getDailySummary');
    cy.get('[aria-label="Export CSV"]').should('be.visible');
  });

  it('shows date range inputs (from and to)', () => {
    cy.get('input[type="date"]').should('have.length.at.least', 2);
  });
});

// ── Suite 2: Compliance Alerts Tab ────────────────────────────────────────────

describe('[REGRESSION] Reports — Compliance Alerts Tab', () => {
  beforeEach(() => {
    stubReportApis();
    cy.loginAsDemo();
    cy.visit('/reports/regulatory');
  });

  it('navigating to /reports/regulatory activates Compliance Alerts tab', () => {
    cy.wait('@getAlerts');
    cy.contains('Reports & MIS').should('be.visible');
    // Tab 1 should be selected
    cy.get('[role="tab"]').eq(1).should('have.attr', 'aria-selected', 'true');
  });

  it('shows status filter chips (ALL, PENDING, FILED, DISMISSED)', () => {
    cy.wait('@getAlerts');
    cy.contains('Filter:').should('be.visible');
    cy.contains('ALL').should('be.visible');
    cy.contains('PENDING').should('be.visible');
    cy.contains('FILED').should('be.visible');
    cy.contains('DISMISSED').should('be.visible');
  });

  it('shows compliance alert row with journal number and CTR type chip', () => {
    cy.wait('@getAlerts');
    cy.contains('JNL-20260424-000001').should('be.visible');
    cy.contains('CTR').should('be.visible');
  });

  it('shows File and Dismiss action buttons for PENDING alert', () => {
    cy.wait('@getAlerts');
    cy.contains('button', /File/i).should('be.visible');
    cy.contains('button', /Dismiss/i).should('be.visible');
  });

  it('opens review dialog when File button is clicked', () => {
    cy.wait('@getAlerts');
    cy.contains('button', /File/i).click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('File Compliance Alert').should('be.visible');
    cy.get('[role="dialog"]').contains('Cancel').should('be.visible');
  });
});

// ── Suite 3: Deposit Maturity Tab ─────────────────────────────────────────────

describe('[REGRESSION] Reports — Deposit Maturity Tab', () => {
  beforeEach(() => {
    stubReportApis();
    cy.loginAsDemo();
    cy.visit('/reports');
  });

  it('can click Deposit Maturity tab and shows maturity table', () => {
    cy.contains('[role="tab"]', /Deposit Maturity/i).click();
    cy.wait('@getMaturities');
    cy.contains('FD-2026-000001').should('be.visible');
    cy.contains('FixedDeposit').should('be.visible');
  });

  it('shows red urgency chip for accounts maturing in <7 days', () => {
    cy.contains('[role="tab"]', /Deposit Maturity/i).click();
    cy.wait('@getMaturities');
    // daysToMaturity = 5 → red chip (MUI error color)
    cy.contains('5d').should('be.visible');
  });

  it('shows zero-state message when no maturities', () => {
    // Override maturities with empty array
    cy.intercept('GET', '**/api/account/upcoming-maturities*', { body: MATURITIES_EMPTY }).as('getMaturitiesEmpty');
    cy.contains('[role="tab"]', /Deposit Maturity/i).click();
    cy.wait('@getMaturitiesEmpty');
    cy.contains(/No deposits maturing/i).should('be.visible');
  });
});

// ── Suite 4: Tab Navigation ───────────────────────────────────────────────────

describe('[REGRESSION] Reports — Tab navigation', () => {
  it('Financial Reports tab is active by default at /reports', () => {
    stubReportApis();
    cy.loginAsDemo();
    cy.visit('/reports');
    cy.wait('@getBalances');
    // Tab 0 should be selected
    cy.get('[role="tab"]').eq(0).should('have.attr', 'aria-selected', 'true');
    cy.contains('GL Account Balances').should('be.visible');
  });
});

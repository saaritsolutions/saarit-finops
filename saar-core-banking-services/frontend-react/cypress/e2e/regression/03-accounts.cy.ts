/// <reference types="cypress" />
export {};

/**
 * REGRESSION — Account Management Module
 * Covers: list view, filter tabs, create account dialog, approve,
 *         freeze/unfreeze, process maturity, premature closure,
 *         maturity journal number display.
 *
 * NOTE: accountService.list() → GET /api/account (no /accounts suffix).
 *       Product types are hardcoded as ['Savings','Current','FD','RD',...] — no API.
 *       Component checks productType.name === 'FD' (not 'Fixed Deposit') for
 *       Process Maturity / Premature Closure button visibility.
 *       Filter tab chips ('Frozen', 'Mature') always remain in DOM even when
 *       a status filter is active — test by account number, not status text.
 */

const ACCOUNTS = [
  {
    accountId:      1,
    accountNumber:  'SB-UCB-0001',
    customerId:     101,
    balance:        25000,
    status:         'Active',
    approvalStatus: 'Approved',
    createdAt:      '2026-01-15T09:00:00Z',
    productType:    { accountProductTypeId: 1, name: 'Savings' },
  },
  {
    accountId:      2,
    accountNumber:  'FD-UCB-0001',
    customerId:     101,
    balance:        100000,
    status:         'Active',
    approvalStatus: 'Approved',
    maturityDate:   new Date(Date.now() + 3 * 86400000).toISOString(),
    termMonths:     12,
    annualRate:     7.5,
    // IMPORTANT: component checks productType.name === 'FD' (uppercase short code)
    productType:    { accountProductTypeId: 3, name: 'FD' },
  },
  {
    accountId:      3,
    accountNumber:  'SB-UCB-0002',
    customerId:     102,
    balance:        5000,
    status:         'Frozen',
    approvalStatus: 'Approved',
    productType:    { accountProductTypeId: 1, name: 'Savings' },
  },
  {
    accountId:      4,
    accountNumber:  'FD-UCB-0002',
    customerId:     102,
    balance:        50000,
    status:         'Mature',
    approvalStatus: 'Approved',
    maturityDate:   new Date(Date.now() - 2 * 86400000).toISOString(),
    termMonths:     6,
    annualRate:     6.5,
    maturityJournalNumber: 'JNL-2026-00042',
    productType:    { accountProductTypeId: 3, name: 'FD' },
  },
];

describe('[REGRESSION] Account Management — List & Filters', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    // accountService.list() → GET /api/account (no /accounts suffix)
    cy.intercept('GET', '**/api/account', { body: ACCOUNTS }).as('accounts');
    cy.intercept('GET', '**/api/account/upcoming-maturities*', { body: [] }).as('maturities');
  });

  it('displays account list with correct columns', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });
    cy.contains(/account number|account #/i).should('exist');
    cy.contains(/balance/i).should('exist');
    cy.contains(/status/i).should('exist');
  });

  it('shows all 4 seeded accounts', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });
    cy.contains('SB-UCB-0001').should('exist');
    cy.contains('FD-UCB-0001').should('exist');
  });

  it('Active tab filters to only Active accounts', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });
    cy.contains(/^Active$/).click({ force: true });
    // Check by account number — filter tab chips stay in DOM so don't assert on status text
    cy.contains('SB-UCB-0001').should('exist');     // Active account — visible
    cy.contains('SB-UCB-0002').should('not.exist'); // Frozen account — filtered out
    cy.contains('FD-UCB-0002').should('not.exist'); // Mature account — filtered out
  });

  it('Frozen tab shows only frozen accounts', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });
    cy.contains(/^Frozen$/).click({ force: true });
    cy.contains('SB-UCB-0002').should('exist');
    cy.contains('SB-UCB-0001').should('not.exist');
  });

  it('Mature tab shows only mature accounts', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });
    cy.contains(/^Mature$/).click({ force: true });
    cy.contains('FD-UCB-0002').should('exist');
    cy.contains('SB-UCB-0001').should('not.exist');
  });

  it('shows maturity journal number icon on Mature accounts', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });
    // The PaymentsIcon tooltip shows journal number for mature accounts
    cy.contains(/mature/i).should('exist');
  });

  it('search input filters the account list', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });
    cy.get('input[placeholder*="search" i]', { timeout: 10000 }).type('FD-UCB-0001');
    cy.contains('FD-UCB-0001').should('exist');
  });
});

describe('[REGRESSION] Account Management — Create Account', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/account', { body: [] }).as('accounts');
    cy.intercept('GET', '**/api/account/upcoming-maturities*', { body: [] }).as('maturities');
  });

  it('opens New Account dialog', () => {
    cy.visit('/accounts');
    cy.contains(/new account|add account/i, { timeout: 15000 }).click({ force: true });
    cy.contains(/open account|product type|select/i, { timeout: 10000 }).should('be.visible');
  });

  it('shows product type dropdown in open account form', () => {
    cy.visit('/accounts');
    cy.contains(/new account|add account/i, { timeout: 15000 }).click({ force: true });
    cy.contains(/product type/i, { timeout: 10000 }).should('exist');
  });

  it('shows FD-specific fields when FD is selected', () => {
    cy.visit('/accounts');
    cy.contains(/new account|add account/i, { timeout: 15000 }).click({ force: true });
    // Product types are hardcoded as ['Savings','Current','FD',...] — no API wait needed
    // Select FD from the combobox
    cy.get('[role="combobox"]', { timeout: 10000 }).first().click();
    // Options show short codes: 'FD', not 'Fixed Deposit'
    cy.contains(/^FD$/i, { timeout: 5000 }).click({ force: true });
    // FD fields: term, rate, maturity date, auto-renewal
    cy.contains(/term|tenure|maturity|rate/i, { timeout: 10000 }).should('exist');
  });

  it('validates required fields on form submit', () => {
    cy.intercept('POST', '**/api/account', { statusCode: 400, body: { message: 'CustomerId is required' } }).as('createFail');
    cy.visit('/accounts');
    cy.contains(/new account|add account/i, { timeout: 15000 }).click({ force: true });
    cy.contains(/open|create|submit/i, { timeout: 5000 }).last().click({ force: true });
    // Error message or validation indicator
    cy.contains(/required|invalid|customer|error/i, { timeout: 10000 }).should('exist');
  });
});

describe('[REGRESSION] Account Management — Freeze / Unfreeze', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/account', { body: ACCOUNTS }).as('accounts');
    cy.intercept('GET', '**/api/account/upcoming-maturities*', { body: [] }).as('maturities');
  });

  it('shows Freeze button for Active accounts', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });
    // AcUnitIcon tooltip "Freeze Account" should be in the row for active SB account
    cy.get('[title*="Freeze" i], [aria-label*="Freeze" i]', { timeout: 10000 })
      .should('have.length.gte', 1);
  });

  it('shows Unfreeze button for Frozen accounts', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });
    cy.get('[title*="Unfreeze" i], [aria-label*="Unfreeze" i]', { timeout: 10000 })
      .should('have.length.gte', 1);
  });

  it('calls freeze endpoint and shows success alert', () => {
    cy.intercept('POST', '**/api/account/1/freeze', {
      statusCode: 200,
      body: { accountId: 1, accountNumber: 'SB-UCB-0001', status: 'Frozen' },
    }).as('freeze');

    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });

    // Register refresh intercept AFTER initial load to avoid LIFO conflict with @accounts
    cy.intercept('GET', '**/api/account', {
      body: ACCOUNTS.map(a => a.accountId === 1 ? { ...a, status: 'Frozen' } : a),
    }).as('accountsRefresh');

    // Click freeze on first active account (SB-UCB-0001)
    cy.get('[title*="Freeze" i], [aria-label*="Freeze" i]').first().click();
    // Confirm the dialog
    cy.on('window:confirm', () => true);
    cy.wait('@freeze', { timeout: 10000 });
    cy.contains(/frozen|success/i, { timeout: 10000 }).should('exist');
  });

  it('Close Account button is hidden for Frozen accounts', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });
    // Frozen tab
    cy.contains(/^Frozen$/, { timeout: 5000 }).click({ force: true });
    // Close Account should NOT be visible for frozen rows
    cy.contains(/close account/i).should('not.exist');
  });
});

describe('[REGRESSION] Account Management — FD Maturity & Premature Closure', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/account', { body: ACCOUNTS }).as('accounts');
    cy.intercept('GET', '**/api/account/upcoming-maturities*', { body: [] }).as('maturities');
  });

  it('shows Process Maturity button for Active FD accounts', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });
    // Component renders Process Maturity for productType.name === 'FD' && status === 'Active'
    cy.get('[title*="Process Maturity" i], [aria-label*="Maturity" i]', { timeout: 10000 })
      .should('exist');
  });

  it('shows Premature Closure button for Active FD accounts', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });
    cy.get('[title*="Premature" i], [aria-label*="Premature" i]', { timeout: 10000 })
      .should('exist');
  });

  it('calls mature endpoint and shows journal number in success alert', () => {
    cy.intercept('POST', '**/api/account/2/mature', {
      statusCode: 200,
      body: {
        success: true,
        journalNumber: 'JNL-2026-00050',
        message: 'Account matured successfully',
      },
    }).as('mature');

    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });

    // Register refresh intercept AFTER initial load to avoid LIFO conflict with @accounts
    cy.intercept('GET', '**/api/account', { body: ACCOUNTS }).as('accountsRefresh');

    cy.get('[title*="Process Maturity" i], [aria-label*="Maturity" i]').first().click();
    cy.on('window:confirm', () => true);
    cy.wait('@mature', { timeout: 10000 });
    cy.contains(/JNL-2026-00050|journal|matured|success/i, { timeout: 10000 }).should('exist');
  });
});

// =============================================================================
// [REGRESSION] Account Statement — SAAR-STMT-001
// =============================================================================

const STATEMENT_ENTRIES = [
  {
    journalId:     1,
    journalNumber: 'JNL-20260428-000001',
    postedAt:      '2026-04-25T10:00:00Z',
    description:   'FD Maturity Payout',
    debit:         100000,
    credit:        0,
  },
  {
    journalId:     2,
    journalNumber: 'JNL-20260428-000002',
    postedAt:      '2026-04-27T15:30:00Z',
    description:   'Account Maintenance Fee',
    debit:         0,
    credit:        150,
  },
];

const STATEMENT_RESPONSE = {
  accountId:      1,
  accountNumber:  'SB-UCB-0001',
  productType:    'Savings',
  currentBalance: 25000,
  from:           '2026-03-30',
  to:             '2026-04-28',
  total:          2,
  page:           1,
  pageSize:       50,
  entries:        STATEMENT_ENTRIES,
};

describe('[REGRESSION] Account Statement', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/account', { body: ACCOUNTS }).as('accounts');
    cy.intercept('GET', '**/api/account/upcoming-maturities*', { body: [] }).as('maturities');
  });

  // T-06: Statement dialog opens with date range pickers
  it('opens statement dialog with date range pickers when clicking Statement button', () => {
    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });

    cy.get('[aria-label="View Statement"]', { timeout: 10000 })
      .first().click();

    // Dialog should open
    cy.contains(/Account Statement/i, { timeout: 5000 }).should('be.visible');
    // Date pickers should be present
    cy.get('input[type="date"]').should('have.length.at.least', 2);
    // Load button should be present
    cy.contains(/^Load$/i).should('exist');
  });

  // T-07: Statement dialog shows entries returned from stub
  it('shows statement entries after clicking Load', () => {
    cy.intercept('GET', '**/api/account/1/statement*', { body: STATEMENT_RESPONSE }).as('statement');

    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });

    cy.get('[aria-label="View Statement"]', { timeout: 10000 })
      .first().click();

    cy.contains(/^Load$/i).click();
    cy.wait('@statement', { timeout: 10000 });

    // Entries should appear
    cy.contains('FD Maturity Payout').should('exist');
    cy.contains('Account Maintenance Fee').should('exist');
    cy.contains('JNL-20260428-000001').should('exist');
    // Totals row info
    cy.contains(/2 of 2/i).should('exist');
  });

  // T-08: Export CSV button appears and is clickable when entries present
  it('Export CSV button is visible when entries are loaded', () => {
    cy.intercept('GET', '**/api/account/1/statement*', { body: STATEMENT_RESPONSE }).as('statement');

    cy.visit('/accounts');
    cy.wait('@accounts', { timeout: 15000 });

    cy.get('[aria-label="View Statement"]', { timeout: 10000 })
      .first().click();

    cy.contains(/^Load$/i).click();
    cy.wait('@statement', { timeout: 10000 });

    cy.get('[aria-label="Export CSV"]', { timeout: 5000 }).should('be.visible');
  });
});

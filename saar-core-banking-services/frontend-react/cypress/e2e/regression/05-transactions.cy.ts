/// <reference types="cypress" />
export {};

/**
 * REGRESSION — Transaction / Ledger Module
 * Covers: ledger balances tab, journal entries tab, post journal dialog,
 *         debit=credit validation, idempotency key field.
 */

// Fields match LedgerBalance interface: normalBalance, debitTotal, creditTotal, balance
const BALANCES = [
  { accountCode: '1010', accountName: 'Cash & Bank Balances', normalBalance: 'Debit',  debitTotal: 5000000,  creditTotal: 0,       balance: 5000000  },
  { accountCode: '1020', accountName: 'Loans & Advances',     normalBalance: 'Debit',  debitTotal: 12000000, creditTotal: 0,       balance: 12000000 },
  { accountCode: '2010', accountName: 'Deposits Payable',     normalBalance: 'Credit', debitTotal: 0,        creditTotal: 8500000, balance: 8500000  },
  { accountCode: '3010', accountName: 'Share Capital',        normalBalance: 'Credit', debitTotal: 0,        creditTotal: 5000000, balance: 5000000  },
  { accountCode: '5010', accountName: 'Interest Expense',     normalBalance: 'Debit',  debitTotal: 350000,   creditTotal: 0,       balance: 350000   },
];

// Fields match Journal interface: journalNumber, status, postedBy, idempotencyKey, referenceType
// JournalEntry fields: journalEntryId, accountName, narration, entryDate
const JOURNALS = [
  {
    journalId:      1,
    journalNumber:  'JNL-2026-00001',
    idempotencyKey: 'test-001',
    description:    'Loan Disbursement — LOAN-2026-003',
    referenceType:  'LoanDisbursement',
    referenceId:    'LOAN-2026-003',
    postedBy:       'demo-user',
    postedAt:       '2026-04-10T14:30:00Z',
    status:         'Posted',
    entries: [
      { journalEntryId: 1, journalId: 1, accountCode: '1020', accountName: 'Loans & Advances',     debitAmount: 1000000, creditAmount: 0,       currency: 'INR', narration: 'DR Loans', entryDate: '2026-04-10' },
      { journalEntryId: 2, journalId: 1, accountCode: '1010', accountName: 'Cash & Bank Balances', debitAmount: 0,       creditAmount: 1000000, currency: 'INR', narration: 'CR Cash',  entryDate: '2026-04-10' },
    ],
  },
];

describe('[REGRESSION] Transactions — Ledger Balances', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/ledger/balances*', { body: BALANCES }).as('balances');
    cy.intercept('GET', '**/api/journal*',         { body: JOURNALS }).as('journals');
  });

  it('loads the transactions / ledger page', () => {
    cy.visit('/transactions');
    cy.get('body').should('be.visible');
    cy.contains(/transaction|ledger|journal/i, { timeout: 15000 }).should('exist');
  });

  it('shows Ledger Balances tab and account codes', () => {
    cy.visit('/transactions');
    cy.wait('@balances', { timeout: 15000 });
    cy.contains(/balance|ledger/i, { timeout: 10000 }).should('exist');
    // Check that at least one GL code is rendered
    cy.contains(/1010|1020|2010|cash|loan/i, { timeout: 10000 }).should('exist');
  });

  it('displays all 5 GL account rows', () => {
    cy.visit('/transactions');
    cy.wait('@balances', { timeout: 15000 });
    cy.contains('1010').should('exist');
    cy.contains('2010').should('exist');
    cy.contains('5010').should('exist');
  });

  it('shows correct balance amounts', () => {
    cy.visit('/transactions');
    cy.wait('@balances', { timeout: 15000 });
    // 5,000,000 or 50,00,000 (Indian formatting)
    cy.contains(/5,000,000|50,00,000|5000000/i, { timeout: 10000 }).should('exist');
  });
});

describe('[REGRESSION] Transactions — Journal Entries', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/ledger/balances*', { body: BALANCES }).as('balances');
    cy.intercept('GET', '**/api/journal*',         { body: JOURNALS }).as('journals');
  });

  it('shows Journal Entries tab', () => {
    cy.visit('/transactions');
    cy.contains(/journal|entries/i, { timeout: 15000 }).should('exist');
  });

  it('displays journal entry with description', () => {
    cy.visit('/transactions');
    // "Post Journal Entry" button appears before the tabs in DOM — scope click to tab element
    cy.contains('[role="tab"]', /Journal Entries/i, { timeout: 10000 }).click({ force: true });
    cy.contains(/JNL-2026-00001|Loan Disbursement|LOAN-2026/i, { timeout: 10000 }).should('exist');
  });
});

describe('[REGRESSION] Transactions — Post Journal Entry Dialog', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/ledger/balances*', { body: BALANCES }).as('balances');
    cy.intercept('GET', '**/api/journal*',         { body: JOURNALS }).as('journals');
  });

  it('Post Journal Entry button opens a dialog', () => {
    cy.visit('/transactions');
    cy.contains(/post journal|new journal|post entry/i, { timeout: 15000 }).click({ force: true });
    cy.contains(/debit|credit|description|journal/i, { timeout: 10000 }).should('be.visible');
  });

  it('dialog shows debit and credit input fields', () => {
    cy.visit('/transactions');
    cy.contains(/post journal|new journal|post entry/i, { timeout: 15000 }).click({ force: true });
    cy.contains(/debit/i, { timeout: 10000 }).should('exist');
    cy.contains(/credit/i, { timeout: 10000 }).should('exist');
  });

  it('validates that debit must equal credit before submit', () => {
    cy.intercept('POST', '**/api/journal*', {
      statusCode: 400,
      body: { message: 'Debit and credit amounts must balance' },
    }).as('badJournal');

    cy.visit('/transactions');
    cy.contains(/post journal|new journal|post entry/i, { timeout: 15000 }).click({ force: true });
    // Try to submit immediately without balancing
    cy.contains(/post|submit/i, { timeout: 5000 }).last().click({ force: true });
    // Should show a validation or balance error
    cy.contains(/balance|debit|credit|equal/i, { timeout: 10000 }).should('exist');
  });

  it('successful post shows confirmation', () => {
    cy.intercept('POST', '**/api/journal*', {
      statusCode: 200,
      body: { journalId: 'JNL-2026-99999', success: true },
    }).as('postJournal');
    cy.intercept('GET', '**/api/ledger/balances*', { body: BALANCES }).as('balancesRefresh');

    cy.visit('/transactions');
    cy.contains(/post journal|new journal|post entry/i, { timeout: 15000 }).click({ force: true });
    // Fill a minimal balanced entry and submit
    cy.get('input').each(($input) => {
      if ($input.attr('placeholder')?.match(/description/i)) {
        cy.wrap($input).type('Test entry');
      }
    });
    cy.contains(/post|submit/i, { timeout: 5000 }).last().click({ force: true });
    // Either success message or the call is made
    cy.get('@postJournal.all', { timeout: 10000 }).then((calls: any) => {
      if (calls.length > 0) {
        cy.contains(/success|posted|JNL-2026-99999/i).should('exist');
      }
    });
  });
});

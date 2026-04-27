/**
 * 14-interest-fees.cy.ts — SAAR-IFS-001 Regression Tests
 * Deposit Interest tab in Reports + accrual summary data
 */

const ACCRUAL_DATA = [
  { date: '2026-04-24T00:00:00Z', tenantId: 'public', totalInterest: 245.78, accountCount: 8 },
  { date: '2026-04-25T00:00:00Z', tenantId: 'public', totalInterest: 245.78, accountCount: 8 },
  { date: '2026-04-26T00:00:00Z', tenantId: 'public', totalInterest: 251.34, accountCount: 9 },
];

describe('[REGRESSION] Interest Fee Service — Deposit Interest Tab', () => {
  beforeEach(() => {
    cy.loginAsDemo();

    cy.intercept('GET', '**/api/interest-fees/accrual-summary**', {
      statusCode: 200,
      body: ACCRUAL_DATA,
    }).as('accrualSummary');

    cy.intercept('POST', '**/api/interest-fees/run-daily-accrual', {
      statusCode: 200,
      body: { message: 'Daily accrual completed', date: '2026-04-26' },
    }).as('runAccrual');

    cy.intercept('POST', '**/api/interest-fees/run-monthly-posting**', {
      statusCode: 200,
      body: {
        period: '202604',
        tenantsProcessed: 1,
        accountsPosted: 5,
        totalInterest: 3250.45,
        totalTds: 0,
      },
    }).as('runPosting');

    // Stub other Reports tabs to prevent cascading failures
    cy.intercept('GET', '**/api/ledger/balances**',            { statusCode: 200, body: [] }).as('balances');
    cy.intercept('GET', '**/api/journal/daily-summary**',      { statusCode: 200, body: { days: [], grandTotalCount: 0, grandTotalDebit: 0, grandTotalCredit: 0 } }).as('summary');
    cy.intercept('GET', '**/api/compliance/alerts**',          { statusCode: 200, body: { items: [], total: 0, page: 1, pageSize: 20 } }).as('alerts');
    cy.intercept('GET', '**/api/account/upcoming-maturities**',{ statusCode: 200, body: [] }).as('maturities');

    cy.visit('/reports');
  });

  // ── T-6: Tab exists and is clickable ───────────────────────────────────────

  it('T-6: Deposit Interest tab is present and clickable', () => {
    cy.contains('[role="tab"]', /Deposit Interest/i).should('be.visible').click();
    cy.wait('@accrualSummary');
    cy.get('[id="rpt-tabpanel-3"]').should('be.visible');
  });

  // ── T-7: Chart renders with stub data ─────────────────────────────────────

  it('T-7: Accrual summary chart renders when API returns data', () => {
    cy.contains('[role="tab"]', /Deposit Interest/i).click();
    cy.wait('@accrualSummary');

    // Recharts renders <svg> — check it exists
    cy.get('[id="rpt-tabpanel-3"]').find('svg').should('exist');

    // Summary stats should show accrued total
    cy.get('[id="rpt-tabpanel-3"]')
      .contains(/Total Accrued/i)
      .should('be.visible');
  });

  // ── T-8: Run Daily Accrual button is visible ───────────────────────────────

  it('T-8: Run Daily Accrual button is visible and triggers API', () => {
    cy.contains('[role="tab"]', /Deposit Interest/i).click();
    cy.wait('@accrualSummary');

    cy.contains('button', /Run Daily Accrual/i)
      .should('be.visible')
      .click();

    cy.wait('@runAccrual');
    cy.contains(/Accrual completed/i).should('be.visible');
  });

  // ── T-9: Post Monthly Interest button is visible ────────────────────────────

  it('T-9: Post Monthly Interest button is visible and triggers API', () => {
    cy.contains('[role="tab"]', /Deposit Interest/i).click();
    cy.wait('@accrualSummary');

    cy.contains('button', /Post Monthly Interest/i)
      .should('be.visible')
      .click();

    cy.wait('@runPosting');
    // Alert shows posting result
    cy.contains(/Monthly posting complete/i).should('be.visible');
  });

  // ── T-10: Stub returns correct data shape ──────────────────────────────────

  it('T-10: accrual-summary stub returns correct data shape', () => {
    cy.intercept('GET', '**/api/interest-fees/accrual-summary**', (req) => {
      req.reply({
        statusCode: 200,
        body: ACCRUAL_DATA,
      });
    }).as('summaryShape');

    cy.contains('[role="tab"]', /Deposit Interest/i).click();
    cy.wait('@summaryShape').then(({ response }) => {
      expect(response!.statusCode).to.equal(200);
      const body = response!.body as typeof ACCRUAL_DATA;
      expect(body).to.be.an('array');
      expect(body.length).to.be.greaterThan(0);
      expect(body[0]).to.have.keys(['date', 'tenantId', 'totalInterest', 'accountCount']);
    });
  });
});

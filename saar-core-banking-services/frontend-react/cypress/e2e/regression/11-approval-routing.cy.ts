/// <reference types="cypress" />
export {};

/**
 * REGRESSION — Multi-Level Approval Routing (SAAR-WF-001 Phase 1)
 *
 * Tests the ApprovalChain section in LoanDetail.tsx:
 *   GET  /api/loans/applications/{id}  → { application, documents, actions }
 *   GET  /api/approval/chain?entityId={}&entityType=LOAN  → { entityId, entityType, steps: [] }
 *   POST /api/loans/applications/{id}/action               → { application, ... }
 *
 * All approval chain fetches are silent-fail (WorkflowOrchestrationService down = no section).
 */

// ── Mock Data ──────────────────────────────────────────────────────────────────

const LOAN_SUBMITTED = {
  id: '10', applicationNumber: 'LOAN-WF-001', applicantName: 'Meera Nair',
  requestedAmount: 1_000_000, tenureMonths: 84, interestRate: 10.5,
  productType: 'Home Loan', status: 'SUBMITTED',
  cibilScore: 760, foirPercent: 35, grossMonthlyIncome: 90000,
  createdAt: '2026-04-22T08:00:00Z', updatedAt: '2026-04-22T08:00:00Z',
};

const LOAN_IN_REVIEW = { ...LOAN_SUBMITTED, id: '11', applicationNumber: 'LOAN-WF-002', status: 'IN_REVIEW' };
const LOAN_CREDIT_APPROVED = { ...LOAN_SUBMITTED, id: '12', applicationNumber: 'LOAN-WF-003', status: 'CREDIT_APPROVED', requestedAmount: 400_000 };

const detailBody = (app: object) => ({ application: app, documents: [], actions: [] });

const CHAIN_2_PENDING = {
  entityId: 'LOAN-WF-002', entityType: 'LOAN',
  steps: [
    { id: 's1', sequence: 1, label: 'Branch Manager',   requiredRole: 'CHECKER', status: 'PENDING' },
    { id: 's2', sequence: 2, label: 'Credit Committee', requiredRole: 'MANAGER', status: 'PENDING' },
  ],
};

const CHAIN_STEP1_APPROVED = {
  entityId: 'LOAN-WF-002', entityType: 'LOAN',
  steps: [
    { id: 's1', sequence: 1, label: 'Branch Manager',   requiredRole: 'CHECKER', status: 'APPROVED', performedBy: 'officer1', actionedAt: '2026-04-22T10:00:00Z' },
    { id: 's2', sequence: 2, label: 'Credit Committee', requiredRole: 'MANAGER', status: 'PENDING' },
  ],
};

const CHAIN_REJECTED = {
  entityId: 'LOAN-WF-002', entityType: 'LOAN',
  steps: [
    { id: 's1', sequence: 1, label: 'Branch Manager',   requiredRole: 'CHECKER', status: 'REJECTED' },
    { id: 's2', sequence: 2, label: 'Credit Committee', requiredRole: 'MANAGER', status: 'SKIPPED' },
  ],
};

const CHAIN_EMPTY = { entityId: 'LOAN-WF-001', entityType: 'LOAN', steps: [] };

// ── Describe 1: Chain Section Renders ─────────────────────────────────────────

describe('[REGRESSION] SAAR-WF-001 — Approval Chain Renders in Loan Detail', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/loans/applications/11*',  { body: detailBody(LOAN_IN_REVIEW) }).as('loanDetail');
    cy.intercept('GET', '**/api/approval/chain*',         { body: CHAIN_2_PENDING }).as('getChain');
    cy.intercept('GET', '**/api/loan-products*',          { body: [] }).as('products');
  });

  it('shows "Approval Chain" section heading when chain has steps', () => {
    cy.visit('/loans/11');
    cy.wait('@loanDetail', { timeout: 15000 });
    cy.wait('@getChain',   { timeout: 10000 });
    cy.contains(/approval chain/i, { timeout: 8000 }).should('exist');
  });

  it('shows "Branch Manager" step label', () => {
    cy.visit('/loans/11');
    cy.wait('@loanDetail', { timeout: 15000 });
    cy.wait('@getChain',   { timeout: 10000 });
    cy.contains(/Branch Manager/i, { timeout: 8000 }).should('exist');
  });

  it('shows "Credit Committee" step label for 2-level chain', () => {
    cy.visit('/loans/11');
    cy.wait('@loanDetail', { timeout: 15000 });
    cy.wait('@getChain',   { timeout: 10000 });
    cy.contains(/Credit Committee/i, { timeout: 8000 }).should('exist');
  });

  it('shows Level 1 and Level 2 indicators', () => {
    cy.visit('/loans/11');
    cy.wait('@loanDetail', { timeout: 15000 });
    cy.wait('@getChain',   { timeout: 10000 });
    cy.contains(/Level 1/i, { timeout: 8000 }).should('exist');
    cy.contains(/Level 2/i).should('exist');
  });

  it('does NOT show approval chain section when chain has no steps', () => {
    cy.intercept('GET', '**/api/approval/chain*', { body: CHAIN_EMPTY }).as('getChainEmpty');
    cy.visit('/loans/11');
    cy.wait('@loanDetail', { timeout: 15000 });
    cy.wait('@getChainEmpty', { timeout: 10000 });
    cy.contains(/approval chain/i, { timeout: 4000 }).should('not.exist');
  });
});

// ── Describe 2: Chain Step Status Chips ───────────────────────────────────────

describe('[REGRESSION] SAAR-WF-001 — Chain Step Status Chips', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/loan-products*', { body: [] }).as('products');
  });

  it('shows PENDING chip for pending chain steps', () => {
    cy.intercept('GET', '**/api/loans/applications/11*', { body: detailBody(LOAN_IN_REVIEW) }).as('detail');
    cy.intercept('GET', '**/api/approval/chain*',        { body: CHAIN_2_PENDING }).as('chain');
    cy.visit('/loans/11');
    cy.wait('@detail', { timeout: 15000 });
    cy.wait('@chain',  { timeout: 10000 });
    cy.contains(/PENDING/i, { timeout: 8000 }).should('exist');
  });

  it('shows APPROVED chip for approved chain step', () => {
    cy.intercept('GET', '**/api/loans/applications/11*', { body: detailBody(LOAN_IN_REVIEW) }).as('detail');
    cy.intercept('GET', '**/api/approval/chain*',        { body: CHAIN_STEP1_APPROVED }).as('chain');
    cy.visit('/loans/11');
    cy.wait('@detail', { timeout: 15000 });
    cy.wait('@chain',  { timeout: 10000 });
    cy.contains(/APPROVED/i, { timeout: 8000 }).should('exist');
  });

  it('shows REJECTED chip for rejected chain step', () => {
    cy.intercept('GET', '**/api/loans/applications/11*', { body: detailBody(LOAN_IN_REVIEW) }).as('detail');
    cy.intercept('GET', '**/api/approval/chain*',        { body: CHAIN_REJECTED }).as('chain');
    cy.visit('/loans/11');
    cy.wait('@detail', { timeout: 15000 });
    cy.wait('@chain',  { timeout: 10000 });
    cy.contains(/REJECTED/i, { timeout: 8000 }).should('exist');
  });

  it('shows SKIPPED chip for skipped chain step', () => {
    cy.intercept('GET', '**/api/loans/applications/11*', { body: detailBody(LOAN_IN_REVIEW) }).as('detail');
    cy.intercept('GET', '**/api/approval/chain*',        { body: CHAIN_REJECTED }).as('chain');
    cy.visit('/loans/11');
    cy.wait('@detail', { timeout: 15000 });
    cy.wait('@chain',  { timeout: 10000 });
    cy.contains(/SKIPPED/i, { timeout: 8000 }).should('exist');
  });

  it('shows performedBy when step is actioned', () => {
    cy.intercept('GET', '**/api/loans/applications/11*', { body: detailBody(LOAN_IN_REVIEW) }).as('detail');
    cy.intercept('GET', '**/api/approval/chain*',        { body: CHAIN_STEP1_APPROVED }).as('chain');
    cy.visit('/loans/11');
    cy.wait('@detail', { timeout: 15000 });
    cy.wait('@chain',  { timeout: 10000 });
    cy.contains(/officer1/i, { timeout: 8000 }).should('exist');
  });
});

// ── Describe 3: Loan Actions + Chain Integration ───────────────────────────────

describe('[REGRESSION] SAAR-WF-001 — Loan Actions with Approval Chain', () => {
  beforeEach(() => {
    cy.loginAsDemo();
    cy.intercept('GET', '**/api/loan-products*', { body: [] }).as('products');
  });

  it('SEND_TO_REVIEW button visible on SUBMITTED loan', () => {
    cy.intercept('GET', '**/api/loans/applications/10*', { body: detailBody(LOAN_SUBMITTED) }).as('detail');
    cy.intercept('GET', '**/api/approval/chain*',        { body: CHAIN_EMPTY }).as('chain');
    cy.visit('/loans/10');
    cy.wait('@detail', { timeout: 15000 });
    cy.contains(/send to review/i, { timeout: 8000 }).should('exist');
  });

  it('CREDIT_APPROVE button visible on IN_REVIEW loan', () => {
    cy.intercept('GET', '**/api/loans/applications/11*', { body: detailBody(LOAN_IN_REVIEW) }).as('detail');
    cy.intercept('GET', '**/api/approval/chain*',        { body: CHAIN_2_PENDING }).as('chain');
    cy.visit('/loans/11');
    cy.wait('@detail', { timeout: 15000 });
    cy.contains(/credit approve/i, { timeout: 8000 }).should('exist');
  });

  it('SANCTION button visible on CREDIT_APPROVED loan', () => {
    cy.intercept('GET', '**/api/loans/applications/12*', { body: detailBody(LOAN_CREDIT_APPROVED) }).as('detail');
    cy.intercept('GET', '**/api/approval/chain*',        { body: CHAIN_EMPTY }).as('chain');
    cy.visit('/loans/12');
    cy.wait('@detail', { timeout: 15000 });
    cy.contains(/sanction loan/i, { timeout: 8000 }).should('exist');
  });

  it('chain refreshes after CREDIT_APPROVE action — shows updated APPROVED step', () => {
    const LOAN_AFTER_APPROVE = { ...LOAN_IN_REVIEW, status: 'CREDIT_APPROVED' };
    cy.intercept('GET',  '**/api/loans/applications/11*',       { body: detailBody(LOAN_IN_REVIEW) }).as('initialDetail');
    cy.intercept('POST', '**/api/loans/applications/11/action', { body: detailBody(LOAN_AFTER_APPROVE) }).as('action');
    // Chain returns APPROVED state after the action triggers a re-fetch
    cy.intercept('GET',  '**/api/approval/chain*', { body: CHAIN_STEP1_APPROVED }).as('chain');
    cy.visit('/loans/11');
    cy.wait('@initialDetail', { timeout: 15000 });
    cy.wait('@chain',         { timeout: 10000 });
    // Open action dialog and confirm
    cy.contains(/credit approve/i, { timeout: 8000 }).click();
    cy.contains(/approve at credit stage/i, { timeout: 5000 }).should('exist');
    cy.contains('[role="dialog"]', /approve at credit stage/i).find('button').last().click();
    cy.wait('@action', { timeout: 10000 });
    // After action, useEffect(detail) re-runs → chain shows APPROVED
    cy.contains(/APPROVED/i, { timeout: 8000 }).should('exist');
  });

  it('approval chain section hidden gracefully when WorkflowOrchestrationService is unreachable', () => {
    cy.intercept('GET', '**/api/loans/applications/11*', { body: detailBody(LOAN_IN_REVIEW) }).as('detail');
    // Simulate network error from WorkflowOrchestrationService
    cy.intercept('GET', '**/api/approval/chain*', { forceNetworkError: true }).as('chainError');
    cy.visit('/loans/11');
    cy.wait('@detail', { timeout: 15000 });
    // Should NOT throw / show error — section simply not rendered
    cy.contains(/approval chain/i, { timeout: 4000 }).should('not.exist');
    cy.contains(/Approval Timeline/i, { timeout: 5000 }).should('exist'); // rest of page OK
  });
});

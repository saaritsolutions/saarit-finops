#!/usr/bin/env node
/**
 * Jira ticket bulk creator for E2E Loan Origination epic
 * Usage: node jira-create-tickets.js
 * Reads credentials from .jira.env
 */
const https = require('https');
const fs    = require('fs');

// ── Load credentials ──────────────────────────────────────────────────────────
const envRaw = fs.readFileSync('.jira.env', 'utf8');
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_TOKEN } = env;
const HOST = new URL(JIRA_BASE_URL).hostname;
const AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');
const PROJECT = 'SCRUM';

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function jiraRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: HOST,
      path,
      method,
      headers: {
        'Authorization': `Basic ${AUTH}`,
        'Accept':        'application/json',
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getLatestIssueNumber() {
  const r = await jiraRequest('POST', '/rest/api/3/search/jql', {
    jql: `project=${PROJECT} ORDER BY created DESC`,
    maxResults: 1,
    fields: ['summary'],
  });
  if (r.status !== 200) { console.error('Search failed:', r.body); process.exit(1); }
  const key = r.body.issues?.[0]?.key ?? `${PROJECT}-159`;
  return parseInt(key.split('-')[1]);
}

async function createEpic(summary, description) {
  const r = await jiraRequest('POST', '/rest/api/3/issue', {
    fields: {
      project:   { key: PROJECT },
      summary,
      description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] },
      issuetype: { name: 'Epic' },
      labels: ['loan-origination', 'investor-demo'],
    },
  });
  if (r.status !== 201) { console.error('Epic creation failed:', JSON.stringify(r.body)); return null; }
  console.log(`  ✓ Epic created: ${r.body.key} — ${summary}`);
  return r.body.key;
}

async function createStory(summary, description, epicKey, labels = []) {
  const fields = {
    project:   { key: PROJECT },
    summary,
    description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] },
    issuetype: { name: 'Story' },
    labels: ['loan-origination', ...labels],
  };
  // Link to epic via parent (Jira Cloud next-gen) or customfield_10008 (team-managed)
  if (epicKey) {
    fields['parent'] = { key: epicKey };
  }
  const r = await jiraRequest('POST', '/rest/api/3/issue', { fields });
  if (r.status !== 201) { console.error(`  ✗ Story failed (${summary.slice(0,40)}):`, r.body.errors || r.body.errorMessages); return null; }
  console.log(`    ✓ ${r.body.key} — ${summary}`);
  return r.body.key;
}

// ── Ticket definitions ────────────────────────────────────────────────────────
const EPICS = [
  {
    summary: '[LoanFlow-1] Enhanced Loan Application Data Model',
    description: 'Complete backend data model for enterprise-grade loan origination: applicant details, financials, documents, approval audit trail, product master.',
    stories: [
      { summary: 'Extend LoanApplication entity with full applicant fields (name, DOB, PAN, Aadhaar, address, employment, income)', description: 'Add PersonalDetails, EmploymentDetails, FinancialDetails as EF-owned entities or JSON columns on LoanApplication. Include PAN, Aadhaar (masked), mobile, email, DOB, gender, marital status, address (current + permanent), employer name, designation, monthly income, other income, liabilities, FOIR.' },
      { summary: 'Add LoanProduct master: Home/Personal/Business/Gold/Vehicle with rate bands, max tenure, processing fee config', description: 'LoanProduct entity: productCode, name, category (SECURED/UNSECURED), minAmount, maxAmount, minTenureMonths, maxTenureMonths, baseRatePercent, processingFeePercent, requiresCollateral, documentChecklist (JSON). Seed 5 products on startup.' },
      { summary: 'Add LoanDocument entity: checklist per product, upload status, verified flag', description: 'LoanDocument entity linked to LoanApplicationId: documentType (PAN_CARD/AADHAAR/SALARY_SLIP/ITR/BANK_STATEMENT/PROPERTY_DOCS etc), fileName, uploadedAt, isVerified, verifiedBy, remarks. API: GET checklist per product, POST upload (base64 stub), PATCH verify.' },
      { summary: 'Add LoanApprovalAction audit trail (who approved/rejected, when, comments, role)', description: 'LoanApprovalAction entity: loanApplicationId, action (SUBMIT/REVIEW/APPROVE/REJECT/DISBURSE), actionBy, role, comments, actionAt. GET /api/loans/{id}/timeline returns full audit trail.' },
      { summary: 'EF Core migration: apply enhanced LoanApplication schema with tenant-aware provisioner', description: 'Add EF Core migration for all new entities. Update TenantSchemaProvisioner to run new migration. Seed 5 LoanProduct records per tenant on startup.' },
      { summary: 'Loan eligibility check API: POST /api/loans/check-eligibility (wired to ExpressionEngine EXPR_1755237353842)', description: 'Endpoint accepts: productType, amount, tenure, monthlyIncome, existingEMI, cibilScore. Returns: isEligible (bool), maxEligibleAmount, recommendedRate, rejectionReasons[], FOIRPercent.' },
      { summary: 'FOIR and LTV calculation endpoints on LoanService', description: 'GET /api/loans/calculate-foir?monthlyIncome=X&existingEMI=Y&proposedEMI=Z returns foirPercent, isWithinLimit. GET /api/loans/calculate-ltv?propertyValue=X&loanAmount=Y returns ltvPercent, isWithinLimit (LTV <= 80%).' },
      { summary: 'Loan state machine: DRAFT→SUBMITTED→CREDIT_REVIEW→LEGAL_REVIEW→SANCTIONED→DISBURSED/REJECTED transitions with guard rules', description: 'Only valid transitions allowed. Each transition records a LoanApprovalAction. Guard: SUBMITTED requires all mandatory docs uploaded. SANCTIONED requires credit_review approved + legal_review approved. DISBURSED creates TransactionService journal entry.' },
    ],
  },
  {
    summary: '[LoanFlow-2] Workflow Engine — Persisted State Machine with Maker-Checker',
    description: 'Persist WorkflowInstance to PostgreSQL, implement real maker-checker approval API, SLA tracking, and tenant-aware workflow templates for loan origination.',
    stories: [
      { summary: 'Persist WorkflowInstance and WorkflowStep to PostgreSQL in WorkflowOrchestrationService', description: 'Add WorkflowDbContext with WorkflowInstance and WorkflowStep EF models. Replace in-memory mock SaveWorkflowInstanceAsync/LoadWorkflowInstanceAsync with real DB calls. Add EF migrations + TenantSchemaProvisioner.' },
      { summary: 'Maker-Checker action API: POST /api/workflows/{id}/actions (APPROVE/REJECT/RETURN with comments)', description: 'Action records who acted (from JWT), validates role is authorised for current step, transitions state, creates audit entry. Returns updated WorkflowInstance. JWT role checked: DRAFT→SUBMIT requires maker, CREDIT_REVIEW requires checker/credit_officer.' },
      { summary: 'SLA tracking: dueAt field per step, overdue flag, escalation log', description: 'Each WorkflowStep gets dueAt (createdAt + SLA hours from config). Add GET /api/workflows/sla-breaches to list overdue instances. Expose isOverdue, overdueHours on WorkflowStepResult.' },
      { summary: 'Loan workflow template: 5-step approval chain seeded per tenant (configurable via expressions)', description: 'Seed LoanApprovalWorkflow template: APPLICATION_SUBMITTED → CREDIT_REVIEW (24h SLA) → LEGAL_REVIEW (48h SLA) → SANCTION_APPROVAL (4h SLA) → DISBURSEMENT_AUTH (2h SLA). SLA hours driven by expression EXPR_WORKFLOW_SLA_LOAN.' },
      { summary: 'POST /api/loans/{id}/submit: trigger workflow, validate docs, return workflowInstanceId', description: 'On submit: validate mandatory docs uploaded, create WorkflowInstance via WorkflowService, update loan status to SUBMITTED, return {loanApplicationId, workflowInstanceId, currentStep, dueAt}.' },
    ],
  },
  {
    summary: '[LoanFlow-3] Real Banking Loan Forms + Approval UI (Frontend)',
    description: 'Complete frontend implementation: 6-step real banking application form, live eligibility check, document upload checklist, maker-checker approval dashboard, loan timeline.',
    stories: [
      { summary: 'Step 1 — Personal & KYC Details: full form with PAN, Aadhaar, DOB, gender, address (current + permanent)', description: 'Fields: Full Name, DOB (DatePicker), gender (radio), marital status, PAN (with format validation XX0000X), Aadhaar (masked), mobile (verified chip), email, current address (line1/2/city/state/pin), same-as-current toggle for permanent address. Real MUI form with inline validation.' },
      { summary: 'Step 2 — Employment & Income Details: employer, designation, income, liabilities', description: 'Fields: employment type (Salaried/Self-Employed/Business), employer name, designation, years at current job, gross monthly income, other income sources, existing EMIs (running total), monthly obligations. FOIR calculator shown live.' },
      { summary: 'Step 3 — Loan Parameters: product type, amount, tenure, purpose, collateral', description: 'Loan product selector (card grid with rate/limit info), amount slider + text input with min/max from product config, tenure selector (6/12/24/36/60/84/120 months), loan purpose dropdown, collateral details (conditional on product type). EMI panel updates live from expression engine.' },
      { summary: 'Step 4 — Co-applicant & Guarantor section (conditional by product type)', description: 'Toggle to add co-applicant. If added: same fields as Step 1 for co-applicant. Guarantor section (optional for unsecured, mandatory for high-value). Add/remove buttons, summary cards.' },
      { summary: 'Step 5 — Document Upload with product-specific checklist', description: 'Checklist fetched from GET /api/loans/checklist/{productType}. Each document: label, mandatory flag, upload button (PDF/JPG), uploaded file name + remove. Progress bar: X of Y documents uploaded. Cannot proceed to Step 6 until mandatory docs uploaded.' },
      { summary: 'Step 6 — Review & Submit: full summary card + declaration checkbox + submit with workflow trigger', description: 'Two-column summary of all entered data. Eligibility check result panel (green/red). Declaration checkbox (RBI-mandated consent text). Submit button calls POST /api/loans + POST /api/loans/{id}/submit. Shows workflowInstanceId on success.' },
      { summary: 'Loan Management list: filters by status/product/date, real data from API, export button', description: 'Table with: App ID, Applicant Name, Product, Amount, Status chip (coloured), Submitted date, Assigned To, Action buttons (View/Approve/Reject). Filter bar: status chips, product dropdown, date range. Export to CSV stub.' },
      { summary: 'Loan detail / approval view: full application summary + workflow timeline + approve/reject actions', description: 'Full read-only view of application data. Workflow timeline component showing each step (done/current/pending), who acted, when, comments. Approve/Reject buttons for users with checker/approver role. Comments textarea required on reject.' },
      { summary: 'Maker-Checker approval dashboard: pending approvals queue with SLA countdown', description: 'Dedicated page /loans/approvals for checker role. Shows all loans in CREDIT_REVIEW or LEGAL_REVIEW state assigned to current user. Sorted by dueAt (soonest first). SLA countdown chips (red if overdue). Bulk approve capability.' },
      { summary: 'Live eligibility check panel in Step 3: calls /api/loans/check-eligibility on amount/tenure change', description: 'Debounced call (500ms) on amount or tenure change. Shows: Eligible (green check) or Not Eligible (red), max amount, recommended rate, FOIR%, rejection reasons if any. Animated update.' },
    ],
  },
  {
    summary: '[LoanFlow-4] Integration, Seeding & End-to-End Demo Script',
    description: 'Wire all services together, seed realistic demo data, write a step-by-step demo walkthrough for investor presentation.',
    stories: [
      { summary: 'Wire LoanService → TransactionService on disbursement: create journal entry (Loan A/c DR, Customer A/c CR)', description: 'On loan status → DISBURSED: POST to TransactionService /api/journal/post with debit=LOAN_PORTFOLIO_1000, credit=CUSTOMER_SAVINGS_{customerId}, amount=sanctionedAmount, ref=loanApplicationId. Handle failure with compensating action.' },
      { summary: 'Seed realistic demo data: 3 loan applications per tenant in different workflow states', description: 'On startup, seed 3 LoanApplications per tenant: one DRAFT, one in CREDIT_REVIEW (with partial docs), one SANCTIONED. Include realistic Indian names, addresses, PAN numbers. Seed LoanApprovalActions for the reviewed ones.' },
      { summary: 'Demo walkthrough document: step-by-step investor demo script for E2E loan flow', description: 'Create DEMO_LOAN_FLOW.md: step-by-step guide showing (1) Login as maker, (2) Create new loan application, (3) Upload docs, (4) Submit → workflow triggers, (5) Login as checker, (6) Review + approve, (7) Sanction letter, (8) Disburse → journal entry visible in TransactionService.' },
    ],
  },
];

// Epics already created in previous run — map summaries to known keys
const EXISTING_EPIC_KEYS = {
  '[LoanFlow-1] Enhanced Loan Application Data Model': 'SCRUM-160',
  '[LoanFlow-2] Workflow Engine — Persisted State Machine with Maker-Checker': 'SCRUM-161',
  '[LoanFlow-3] Real Banking Loan Forms + Approval UI (Frontend)': 'SCRUM-162',
  '[LoanFlow-4] Integration, Seeding & End-to-End Demo Script': 'SCRUM-163',
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Checking latest issue number...');
  const latest = await getLatestIssueNumber();
  console.log(`Latest SCRUM issue: SCRUM-${latest}\n`);

  let totalCreated = 0;
  for (const epic of EPICS) {
    const epicKey = EXISTING_EPIC_KEYS[epic.summary.replace(/^\[LoanFlow-\d\] /, '[LoanFlow-' + (EPICS.indexOf(epic)+1) + '] ')]
      || EXISTING_EPIC_KEYS[epic.summary];
    console.log(`\nEpic: ${epicKey} — ${epic.summary.slice(0, 60)}`);

    for (const story of epic.stories) {
      await createStory(story.summary, story.description, epicKey);
      totalCreated++;
      await new Promise(r => setTimeout(r, 250)); // rate limit
    }
  }

  console.log(`\n✓ Done. Created ${totalCreated} stories.`);
}

main().catch(console.error);

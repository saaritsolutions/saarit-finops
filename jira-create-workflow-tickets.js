#!/usr/bin/env node
/**
 * Jira ticket bulk creator for Workflow Engine + AccountService wiring + Deposits
 * Usage: node jira-create-workflow-tickets.js
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
  const key = r.body.issues?.[0]?.key ?? `${PROJECT}-188`;
  return parseInt(key.split('-')[1]);
}

async function createEpic(summary, description, labels = []) {
  const r = await jiraRequest('POST', '/rest/api/3/issue', {
    fields: {
      project:     { key: PROJECT },
      summary,
      description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] },
      issuetype:   { name: 'Epic' },
      labels:      ['workflow-engine', 'investor-demo', ...labels],
    },
  });
  if (r.status !== 201) { console.error('Epic creation failed:', JSON.stringify(r.body)); return null; }
  console.log(`  ✓ Epic created: ${r.body.key} — ${summary}`);
  return r.body.key;
}

async function createStory(summary, description, epicKey, labels = []) {
  const fields = {
    project:     { key: PROJECT },
    summary,
    description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] },
    issuetype:   { name: 'Story' },
    labels:      ['workflow-engine', 'investor-demo', ...labels],
  };
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
    summary: '[WorkflowEngine-1] Workflow DB Persistence + Multi-Tenancy',
    description: 'Replace in-memory stub in WorkflowOrchestrationService with real EF Core 9 + PostgreSQL persistence. Apply full multi-tenancy pattern (schema-per-tenant) identical to LoanService.',
    labels: ['workflow-engine'],
    stories: [
      {
        summary: 'Add EF Core 9 / Npgsql 9 NuGet packages to WorkflowOrchestrationService',
        description: 'Add Npgsql.EntityFrameworkCore.PostgreSQL 9.0.4, Microsoft.EntityFrameworkCore.Design 9.0.6 (PrivateAssets=all), Microsoft.EntityFrameworkCore.InMemory 9.0.6, Microsoft.AspNetCore.Authentication.JwtBearer 8.0.0 to WorkflowOrchestrationService.csproj.',
      },
      {
        summary: 'Extract inline models from WorkflowController into WorkflowModels.cs',
        description: 'Move StartWorkflowRequest, ProcessStepRequest, WorkflowInstance (DTO), WorkflowStepResult, WorkflowRouting, ApprovalRequirement, StepCompletionResult, ExpressionExecutionResponse into WorkflowOrchestrationService/Models/WorkflowModels.cs.',
      },
      {
        summary: 'Create WorkflowInstanceEntity EF model with ContextJson + ApprovalRequirementsJson',
        description: 'Create WorkflowOrchestrationService/Models/WorkflowInstanceEntity.cs: Id (Guid PK), WorkflowType (varchar 100), EntityId (Guid, indexed), EntityType (varchar 50), CurrentStep (varchar 100), Status (varchar 50, indexed), ContextJson (text), ApprovalRequirementsJson (text), CreatedAt, UpdatedAt, CompletedAt?.',
      },
      {
        summary: 'Create WorkflowDbContext with HasDefaultSchema + TenantModelCacheKeyFactory',
        description: 'Create WorkflowOrchestrationService/Data/WorkflowDbContext.cs. Two constructors (DI + design-time). DbSet<WorkflowInstanceEntity>. OnModelCreating: HasDefaultSchema(TenantSchema) + index on EntityId/Status. OnConfiguring: ReplaceService TenantModelCacheKeyFactory + ConfigureWarnings PendingModelChangesWarning.',
      },
      {
        summary: 'Copy multi-tenancy files (ITenantService, TenantResolutionMiddleware, TenantModelCacheKeyFactory, TenantSchemaProvisioner) to WorkflowOrchestrationService',
        description: 'Copy 4 files from LoanService, change namespaces to WorkflowOrchestrationService.*, replace LoanDbContext→WorkflowDbContext. TenantSchemaProvisioner uses EF9 simple version (no manual __EFMigrationsHistory block).',
      },
      {
        summary: 'Replace LoadWorkflowInstanceAsync / SaveWorkflowInstanceAsync stubs with real EF DB calls',
        description: 'LoadWorkflowInstanceAsync: query _db.WorkflowInstances.FirstOrDefaultAsync, deserialize ContextJson → Dictionary<string,object>. SaveWorkflowInstanceAsync: upsert pattern (Add if not found, update if found), serialize context to ContextJson, SaveChangesAsync.',
      },
      {
        summary: 'Update WorkflowOrchestrationService Program.cs: JWT, HttpContextAccessor, DbContext, TenantSchemaProvisioner',
        description: 'Add JWT auth block (same secret/issuer/audience as other services), AddHttpContextAccessor, AddScoped<ITenantService>, AddDbContext<WorkflowDbContext>, TenantSchemaProvisioner.ProvisionAllSchemasAsync on startup, UseAuthentication + UseTenantResolution middleware.',
      },
      {
        summary: 'Generate and audit EF migration InitialCreate for WorkflowOrchestrationService',
        description: 'Run dotnet ef migrations add InitialCreate. Audit generated file: strip all schema: "public", from CreateTable/CreateIndex calls and remove migrationBuilder.EnsureSchema("public"). Table should be unqualified "WorkflowInstances".',
      },
    ],
  },
  {
    summary: '[WorkflowEngine-2] LoanService → Real WorkflowOrchestrationService',
    description: 'Switch LoanService from the file-based FileWorkflowOrchestrator stub to the real WorkflowOrchestrationService over HTTP. Wire SUBMIT and DISBURSE actions.',
    labels: ['workflow-engine'],
    stories: [
      {
        summary: 'Flip UseLocalWorkflowOrchestrator feature flag to false in LoanService',
        description: 'Change "UseLocalWorkflowOrchestrator": true → false in LoanService/appsettings.Development.json. This causes LoanOriginationController.Submit to use _workflow.StartLoanOriginationAsync instead of the file-based local orchestrator.',
      },
      {
        summary: 'Confirm LoanOriginationController.Submit already calls StartLoanOriginationAsync when UseLocalWorkflowOrchestrator=false',
        description: 'Verify the else branch in the workflow block calls _workflow.StartLoanOriginationAsync, stores wf.Id in app.WorkflowInstanceId, and adopts wf.Status. No code changes needed if already correct.',
      },
      {
        summary: 'Add fire-and-forget workflow ProcessStep(DISBURSE) call to LoanApplicationsController.TakeAction',
        description: 'In the DISBURSE case of TakeAction: after setting status=DISBURSED, add fire-and-forget Task.Run that calls _workflowClient.ProcessStepAsync(app.WorkflowInstanceId.Value, "DISBURSE", context). Skip if WorkflowInstanceId is null. Catch+log any failure.',
      },
      {
        summary: 'Confirm WorkflowInstanceId already exists on LoanApplication entity (no new migration needed)',
        description: 'Verify the LoanApplication EF model already has public Guid? WorkflowInstanceId property (added in migration AddLoanApplication). No new migration required.',
      },
    ],
  },
  {
    summary: '[WorkflowEngine-3] Expression Routing Seeds for Workflow',
    description: 'Seed 4 new workflow routing expressions in ExpressionBuilderService, and add string-result fallback to WorkflowRuleService so Roslyn-returned plain strings are accepted as routing results.',
    labels: ['workflow-engine'],
    stories: [
      {
        summary: 'Seed EXPR_ROUTING_LOAN_ORIGINATION in ExpressionBuilderService',
        description: 'Add to ExpressionSeedService.BuildExpressionSeeds(): ExpressionId=EXPR_ROUTING_LOAN_ORIGINATION, Category=WorkflowRouting, ReturnType=string. Expression: workflow_currentStep == "START" ? "CREDIT_REVIEW" : workflow_currentStep == "CREDIT_REVIEW" ? "LEGAL_REVIEW" : workflow_currentStep == "LEGAL_REVIEW" ? "SANCTION_APPROVAL" : "COMPLETED".',
      },
      {
        summary: 'Seed EXPR_APPROVAL_LOAN_ORIGINATION in ExpressionBuilderService',
        description: 'Add to BuildExpressionSeeds(): ExpressionId=EXPR_APPROVAL_LOAN_ORIGINATION, Category=WorkflowRouting, ReturnType=string. Expression: "MANAGER". This returns the required approver role.',
      },
      {
        summary: 'Seed EXPR_ROUTING_ACCOUNT_OPENING in ExpressionBuilderService',
        description: 'Add to BuildExpressionSeeds(): ExpressionId=EXPR_ROUTING_ACCOUNT_OPENING, Category=WorkflowRouting, ReturnType=string. Expression: workflow_currentStep == "START" ? "MAKER_REVIEW" : workflow_currentStep == "MAKER_REVIEW" ? "CHECKER_APPROVAL" : "COMPLETED".',
      },
      {
        summary: 'Seed EXPR_APPROVAL_ACCOUNT_OPENING in ExpressionBuilderService',
        description: 'Add to BuildExpressionSeeds(): ExpressionId=EXPR_APPROVAL_ACCOUNT_OPENING, Category=WorkflowRouting, ReturnType=string. Expression: "CHECKER". Returns required approver role for account opening workflow.',
      },
      {
        summary: 'Add string-result fallback to EvaluateRoutingRulesAsync in WorkflowRuleService',
        description: 'When the Roslyn expression engine returns a plain string (not an object with .nextStep), treat the trimmed/unquoted string as the NextStep value. Also: approval expressions now return a plain role string — wrap it into a single ApprovalRequirement in code. Default step-completion to CanProceed=true when expression is missing.',
      },
    ],
  },
  {
    summary: '[AccountWiring-1] AccountService — Expression + Workflow + DynamicForms Integration',
    description: 'Wire AccountService to the 3 platform services: ExpressionBuilderService (deposit rate), WorkflowOrchestrationService (maker-checker), DynamicFieldsSchemaService (form schema). Upgrade from EF8 to EF9.',
    labels: ['deposits'],
    stories: [
      {
        summary: 'Upgrade AccountService EF Core 8 → 9.0.6 and Npgsql 8 → 9.0.4',
        description: 'Update AccountService.csproj: Microsoft.EntityFrameworkCore 8.0.0 → 9.0.6, Microsoft.EntityFrameworkCore.Design 8.0.0 → 9.0.6, Npgsql.EntityFrameworkCore.PostgreSQL 8.0.0 → 9.0.4. Add Microsoft.EntityFrameworkCore.InMemory 9.0.6.',
      },
      {
        summary: 'Simplify AccountService TenantSchemaProvisioner after EF9 upgrade',
        description: 'Remove the manual __EFMigrationsHistory CREATE TABLE block from TenantSchemaProvisioner (EF Core 9 handles this automatically). Simplify to: CREATE SCHEMA IF NOT EXISTS + MigrateAsync.',
      },
      {
        summary: 'Create AccountService/Services/IExpressionEvaluationService.cs with CalculateDepositInterestRateAsync',
        description: 'Interface: EvaluateExpressionAsync<T> + CalculateDepositInterestRateAsync(accountType, amount, termMonths). Implementation: calls EXPR_FD_RATE_001 with {days=termMonths*30, amount, accountType}. Returns null on failure (never throws). Identical JSON deserialization logic as LoanService version.',
      },
      {
        summary: 'Create AccountService/Services/IWorkflowClient.cs with StartAccountOpeningAsync',
        description: 'Interface: StartAccountOpeningAsync(entityId, context) + ProcessStepAsync(instanceId, action, context). Implementation posts to WorkflowOrchestrationService /api/Workflow/start with workflowType="ACCOUNT_OPENING", entityType="ACCOUNT".',
      },
      {
        summary: 'Create AccountService/Services/IDynamicFormsClient.cs with GetAccountFormSchemaAsync',
        description: 'Interface + implementation. GetAccountFormSchemaAsync(accountType) fetches from DynamicFieldsSchemaService /api/Fields. Returns List<AccountDynamicField> (Id, Name, Label, Type, Required, Min, Max).',
      },
      {
        summary: 'Register 3 typed HttpClients in AccountService Program.cs + add Services section to appsettings',
        description: 'AddHttpClient<IExpressionEvaluationService, ExpressionEvaluationService>, AddHttpClient<IWorkflowClient, WorkflowClient>, AddHttpClient<IDynamicFormsClient, DynamicFormsClient>. BaseAddress from config Services:ExpressionBaseUrl / WorkflowBaseUrl / DynamicFormsBaseUrl. Add Services section to appsettings.Development.json with localhost defaults.',
      },
      {
        summary: 'Wire deposit interest rate fetch + workflow start into AccountController.CreateAccount',
        description: 'In CreateAccount: if productType==FD or RD, require TermMonths, compute MaturityDate=DateOpened.AddMonths(TermMonths). After SaveChangesAsync: fire-and-forget expression call to populate InterestRate. Fire-and-forget workflow start via StartAccountOpeningAsync, store returned WorkflowInstanceId on account.',
      },
      {
        summary: 'Wire workflow ProcessStep(APPROVE) into AccountController.ApproveAccount',
        description: 'In ApproveAccount: after setting ApprovalStatus=Approved and SaveChangesAsync, add fire-and-forget Task.Run calling _workflow.ProcessStepAsync(account.WorkflowInstanceId.Value, "APPROVE", context). Skip if WorkflowInstanceId is null.',
      },
      {
        summary: 'Add GET /api/account/{id}/eligible-rate endpoint',
        description: 'New endpoint: GET /api/account/{id}/eligible-rate. Loads account + ProductType. Calls CalculateDepositInterestRateAsync if TermMonths is set. Returns {accountId, accountType, interestRate} — returns null interestRate gracefully if expression engine unavailable.',
      },
    ],
  },
  {
    summary: '[Deposits-1] FD/RD Account Lifecycle — Deposit Account Management',
    description: 'Extend Account model with deposit fields, generate EF migration, and implement FD/RD business lifecycle: maturity, premature closure, installment tracking for RD.',
    labels: ['deposits'],
    stories: [
      {
        summary: 'Add deposit fields to Account model: TermMonths, MaturityDate, InterestRate, AutoRenewal, InstallmentAmount, PrematureClosurePenalty, WorkflowInstanceId',
        description: 'Add nullable fields to AccountService/Models/Account.cs after IsTDSExempt: int? TermMonths, DateTime? MaturityDate, decimal? InterestRate, bool AutoRenewal (default false), decimal? InstallmentAmount (RD monthly), decimal? PrematureClosurePenalty (penalty % on early exit), Guid? WorkflowInstanceId.',
      },
      {
        summary: 'Generate and audit EF migration AddDepositFields for AccountService',
        description: 'Run dotnet ef migrations add AddDepositFields. Audit generated file: strip all schema: "public", qualifiers from AddColumn calls in both Up() and Down(). All table names must be unqualified ("Accounts").',
      },
      {
        summary: 'POST /api/account/{id}/mature — mark FD/RD as matured, optionally auto-renew',
        description: 'Endpoint: POST /api/account/{id}/mature. Validates account is FD/RD, MaturityDate <= now, status is active. If AutoRenewal=true: reset Balance, extend MaturityDate by TermMonths, fetch new InterestRate from expression engine. If not: set Status=Matured, DateClosed=now.',
      },
      {
        summary: 'POST /api/account/{id}/premature-close — close FD/RD before maturity with penalty calculation',
        description: 'Endpoint: POST /api/account/{id}/premature-close. Validates FD/RD not yet matured. Apply PrematureClosurePenalty% to InterestRate to compute reduced interest. Set Status=PrematurelyClosed, DateClosed=now, record penalty amount in AccountHistory.',
      },
      {
        summary: 'GET /api/account/upcoming-maturities?days=30 — list FDs/RDs maturing within N days',
        description: 'Endpoint: GET /api/account/upcoming-maturities?days=30 (default 30). Returns accounts where ProductType in (FD,RD), MaturityDate between now and now+days, status is active. Sorted by MaturityDate asc. Includes account number, customer ID, amount, rate, maturity date, AutoRenewal flag.',
      },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Checking latest issue number...');
  const latest = await getLatestIssueNumber();
  console.log(`Latest SCRUM issue: SCRUM-${latest}\n`);

  let totalCreated = 0;
  for (const epicDef of EPICS) {
    console.log(`\nCreating epic: ${epicDef.summary.slice(0, 70)}`);
    const epicKey = await createEpic(epicDef.summary, epicDef.description, epicDef.labels || []);
    if (!epicKey) continue;

    for (const story of epicDef.stories) {
      await createStory(story.summary, story.description, epicKey, story.labels || epicDef.labels || []);
      totalCreated++;
      await new Promise(r => setTimeout(r, 300)); // rate limit
    }
  }

  console.log(`\n✓ Done. Created ${EPICS.length} epics + ${totalCreated} stories.`);
}

main().catch(console.error);

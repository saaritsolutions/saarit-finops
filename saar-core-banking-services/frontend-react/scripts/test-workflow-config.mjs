/**
 * Loan Workflow Configuration — API Tests
 *
 * Standalone Node.js script (no browser, no Cypress) that tests the same
 * two scenarios as loan-workflow-config.cy.ts using fetch directly:
 *
 *   Test 1: Reduce loan workflow to 2 steps (removes LEGAL_REVIEW)
 *   Test 2: Restore original 3 steps (re-adds LEGAL_REVIEW)
 *
 * Run:  node scripts/test-workflow-config.mjs
 * Requires the ExpressionBuilderService to be running on localhost:5004.
 */

const API = process.env.EXPRESSION_API_URL || 'http://localhost:5004';
const EXPRESSION_ID = 'EXPR_ROUTING_LOAN_ORIGINATION';

const TWO_STEP =
  'workflow_currentStep == "START" ? "CREDIT_REVIEW" : ' +
  'workflow_currentStep == "CREDIT_REVIEW" ? "SANCTION_APPROVAL" : ' +
  '"COMPLETED"';

const THREE_STEP =
  'workflow_currentStep == "START" ? "CREDIT_REVIEW" : ' +
  'workflow_currentStep == "CREDIT_REVIEW" ? "LEGAL_REVIEW" : ' +
  'workflow_currentStep == "LEGAL_REVIEW" ? "SANCTION_APPROVAL" : ' +
  '"COMPLETED"';

// ── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function getExpression() {
  const res = await fetch(`${API}/api/expressions/by-expression-id/${EXPRESSION_ID}`);
  assert(`GET by-expression-id returns 200`, res.status === 200, `got ${res.status}`);
  if (res.status !== 200) return null;
  return res.json();
}

async function putExpression(guid, expressionText) {
  const res = await fetch(`${API}/api/expressions/${guid}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ExpressionText: expressionText }),
  });
  assert(`PUT /api/expressions/${guid} returns 200`, res.status === 200, `got ${res.status}`);
  return res.status === 200;
}

async function runTest(name, targetExpression, mustInclude, mustExclude) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log(`${'─'.repeat(60)}`);

  // 1 — Fetch expression and get GUID
  console.log('\nStep 1: Fetch expression record');
  const expr = await getExpression();
  if (!expr) { console.error('  ⛔  Cannot continue — expression not found'); failed++; return; }
  const guid = expr.id;
  assert(`Expression has id (GUID)`, !!guid, `got: ${guid}`);
  console.log(`  ℹ️   GUID: ${guid}`);

  // 2 — Update expression text
  console.log('\nStep 2: Update expression via PUT');
  const ok = await putExpression(guid, targetExpression);
  if (!ok) { console.error('  ⛔  Cannot continue — PUT failed'); return; }

  // 3 — Re-fetch and verify
  console.log('\nStep 3: Verify updated expression text');
  const updated = await getExpression();
  if (!updated) { console.error('  ⛔  Cannot continue — re-fetch failed'); failed++; return; }
  const text = updated.expressionText || updated.ExpressionText || '';
  console.log(`  ℹ️   Expression text: ${text}`);

  for (const fragment of mustInclude) {
    assert(`Text includes "${fragment}"`, text.includes(fragment));
  }
  for (const fragment of mustExclude) {
    assert(`Text does NOT include "${fragment}"`, !text.includes(fragment));
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log(`\n🔗  API: ${API}`);
console.log(`📋  Expression: ${EXPRESSION_ID}\n`);

// Health check — use swagger or a simple GET to confirm service is up
try {
  const health = await fetch(`${API}/api/expressions?page=1&pageSize=1`);
  if (health.status >= 500) throw new Error(`service returned ${health.status}`);
  console.log('✅  ExpressionBuilderService is up\n');
} catch (e) {
  console.error(`❌  ExpressionBuilderService not reachable at ${API} — ${e.message}`);
  console.error('    Start the service and retry:');
  console.error('    ASPNETCORE_ENVIRONMENT=Development EXPR_USE_INMEMORY_DB=1 dotnet run --urls http://localhost:5004');
  process.exit(1);
}

await runTest(
  'Reduce loan workflow to 2 steps (removes LEGAL_REVIEW)',
  TWO_STEP,
  ['"CREDIT_REVIEW" ? "SANCTION_APPROVAL"'],
  ['LEGAL_REVIEW']
);

await runTest(
  'Restore loan workflow to original 3 steps (re-adds LEGAL_REVIEW)',
  THREE_STEP,
  ['"CREDIT_REVIEW" ? "LEGAL_REVIEW"', '"LEGAL_REVIEW" ? "SANCTION_APPROVAL"'],
  []
);

// ── summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(60));
if (failed > 0) process.exit(1);

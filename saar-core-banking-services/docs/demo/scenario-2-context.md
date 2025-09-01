## Scenario 2 — (Draft) Credit Limit Increase & Manual Review Flow

Purpose
This document defines the draft demo context for Scenario 2. It is intentionally high level so we can iterate quickly.

Assumptions
1. Demonstrate how a regulatory requirement (Aadhar collection) can be added to the loan application form via the Form Builder.
2. Show how a conversational chat assistant can be used inside the Form Builder to make the change using natural language.
3. Verify the new field appears on the customer-facing form and is enforced (required + validation for 12 digits).
4. Capture audit trails (chat transcript, who approved) and provide a rollback option.
1. Demonstrate a credit limit increase request that triggers a "Manual Review" outcome when the rule detects insufficient income documentation or a borderline credit score.
2. Exercise the admin Expression Builder to add/modify a rule that sends applications into Manual Review for a specific pattern.
- Minimal acceptance criteria
-------------------------
- Playwright test can:
	- Use the Form Builder chat assistant to request "Add a mandatory field 'aadharNumber' (text, 12 digits) to the personal loan form" and apply the suggested change
	- Verify `/loans/new` contains the `Aadhar Number` field and that it enforces 12-digit validation
	- Capture the assistant transcript and the schema change in the audit log UI
- Playwright spec: `frontend-automation/tests/production-ready-e2e.scenario2.spec.js` (skeleton created)
- Demo context: `docs/demo/scenario-2-context.md` (this file)
1. Confirm the assistant prompt(s) to use for the demo (suggested: "Add a mandatory field 'aadharNumber' (text, 12 digits) to the personal loan form and label it 'Aadhar Number'.")
2. I will implement the Playwright steps to: open Form Builder, interact with the chat assistant, apply the change, verify the form and audit log, and run the test locally.
3. Iterate on selectors and timing by running the test locally and fixing flakiness.
Minimal acceptance criteria
-------------------------
- Test skeleton exists and runs (no-op) without failing (placeholder steps).
- A proposed expression rule is written in the spec or documentation.
- Checklist for implementation is visible and assigned to next steps.

Next steps (recommended)
------------------------
1. Confirm the exact business rule you want Scenario 2 to demo (I propose: ManualReview when creditScore between 600–699 OR missing income docs).
2. I will implement the Playwright steps to: create an application, modify expression via UI, submit, and assert the application moved to Manual Review.
3. Iterate on selectors and timing by running the test locally and fixing flakiness.

If you confirm the proposed goal, I will implement the test steps and push another small change.

Last updated: 2025-08-28

# SCOPE_RBI_STUB_SERVICES.md — RBI-Grounded Scope for Unstarted Services

**Purpose:** These 6 services were scaffolded once (initial commit only, 2025-07-20) and never built out.
Since the platform's own domain (NPA/IRAC provisioning, KYC, GL posting, regulatory reporting) is RBI-driven,
scope for each is defined against the relevant RBI Master Direction so the daily automation has a spec to build
against instead of guessing. Verify against the live RBI Master Direction text before finalizing production
logic — RBI updates these periodically (e.g. CIC credit reporting norms just moved to 1 July 2026).

---

## 1. BusinessRulesEngineService
**RBI basis:** Master Direction – Exposure Norms (single/group borrower limits), interest rate reset rules
(EBLR/MCLR repricing), dormancy/inactive account triggers, Fair Practices Code thresholds.
**Scope:** A configurable rule engine that hosts bank policy thresholds as data, not code — single/group
borrower exposure caps, EMI reset triggers on repo-rate change, account dormancy classification (no
customer-induced transaction for specified period), FOIR/LTV limits (already partially in LoanService —
this should become the shared engine LoanService's EligibilityCheckService calls, not a duplicate).
**Depends on:** LoanService (existing FOIR/LTV logic should migrate here to avoid duplication).

## 2. ExtensionPluginService
**RBI basis:** Master Direction – KYC (mandates use of Central KYC Registry / CKYCR), use of Credit
Information Companies (CIBIL/Experian/Equifax/CRIF) for credit checks, Account Aggregator framework.
**Scope:** A plugin/adapter framework for RBI-mandated third-party integrations: CKYCR upload/fetch, CIC
bureau pulls (LoanService currently mocks CIBIL — this service should host the real adapter), Aadhaar
e-KYC, PAN verification (NSDL/Protean). Each integration is a plugin behind a common interface so sandbox
vs. production credentials swap without code changes.
**Depends on:** CustomerService (KYC), LoanService (CIBIL mock → real adapter).

## 3. LowCodeNoCodeAdminService
**RBI basis:** Master Direction – KYC customer due-diligence varies by customer type/risk category, requiring
per-tenant configurable checklists rather than hardcoded forms.
**Scope:** Admin backend for configuring the dynamic KYC/onboarding forms that DynamicFieldsSchemaService
renders — field sets per customer type (individual/corporate/trust), per risk category (low/medium/high),
and per product. This is an admin layer *on top of* DynamicFieldsSchemaService, not a competing schema
engine — do not duplicate DynamicFieldsSchemaService's model.

## 4. ProductConfigurationService
**Status: likely redundant.** ProductParamManagementService already has real EF models/migrations covering
product parameters (rates, tenure, limits) and is actively maintained. Before writing new code here, confirm
with the user whether to (a) delete this service and redirect any references to ProductParamManagementService,
or (b) narrow its scope to something ProductParamManagementService doesn't cover — e.g. RBI-mandated product
*disclosure* content (standardized product T&C text, MITC — Most Important Terms & Conditions — per the Fair
Practices Code) as distinct from product *parameters*. Default recommendation: delete and merge into (b) only
if disclosure-template scope is confirmed; otherwise remove the service.

## 5. TemplateManagementService
**RBI basis:** Key Fact Statement (KFS) mandate — effective 1 Oct 2024, mandatory standardized disclosure
format for all new retail/MSME term loans (credit cards exempt); Fair Practices Code notice requirements for
NPA/SMA classification and recovery communication; loan sanction letter format requirements.
**Scope:** Template management + rendering engine for regulator-mandated customer documents: KFS (structured
per RBI's prescribed format — APR, all-in cost, amortization schedule), sanction letters, NPA/SMA
classification notices, recovery/write-off notices, interest rate reset intimations. Templates are versioned
(ties to VersioningAuditService below) since regulatory wording changes over time and old versions must be
retrievable for audit.
**Depends on:** LoanService (sanction, NPA, restructuring, write-off events already exist and should trigger
template generation).

## 6. VersioningAuditService
**RBI basis:** IT Governance & Cyber Security framework requires immutable audit trails and data retention
(records generally retainable 8–10 years per RBI/PMLA record-keeping requirements); document version history
for anything customer-facing (KFS, sanction letters, T&C) since regulators can ask for the exact version a
customer received.
**Scope:** Immutable audit log service (who/what/when/before-after) for GL postings, KYC status changes,
loan lifecycle events, and document template versions (consumed by TemplateManagementService). This should
subsume any ad-hoc audit logging already duplicated inside AuditLoggingService — check for overlap with
AuditLoggingService before building; likely these two should be merged rather than both built out.

---

## ReportingMISService (separate stub, not in the 6 above)
**RBI basis:** Regulatory MIS/returns — CRILC reporting for large exposures, DSB returns, Basel III capital
adequacy disclosures, XBRL-based regulatory filings.
**Scope:** Note the current codebase already has a "RBI Regulatory Reporting" tab built directly inside
LoanService (SAAR-RPT-002, `/api/loans/reports/regulatory-summary`). Before building this out, decide whether
ReportingMISService should absorb that reporting logic (recommended, since a standalone MIS/returns service is
the right long-term home) or remain unbuilt while LoanService keeps owning it. Building both is duplication.

---

## Open decisions requiring user input (batch into next daily digest)
1. ProductConfigurationService — delete, or narrow to MITC/disclosure scope?
2. VersioningAuditService vs AuditLoggingService — merge into one service?
3. ReportingMISService vs LoanService's existing regulatory-summary endpoint — consolidate which way?

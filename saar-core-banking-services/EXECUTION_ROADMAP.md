# SaaR Core Banking - 90-Day Plan, 3-Year Roadmap, Quarterly Deliveries

Date: 20 Sep 2025
Context: India-first, brutally real assessment. Goal is to convert scaffolding into production-grade, revenue-driving modules fast.

## 🎯 North Star (3 years)
- Build the most cost-effective, modern core banking platform for UCBs/NBFCs in India.
- Moat = Expression Engine + Low-code Config + Modern UX + Rapid Delivery.
- Milestone targets: 100+ customers, ₹150–200 Cr ARR by end of Year 3.

---

## 🚀 First 90 Days (Oct–Dec 2025)
Objective: Convert 3 core areas to production-grade and secure 2 paid pilots.

### Scope & Deliverables
1) CustomerService v1 (Production-ready)
- eKYC (Aadhaar XML/Offline + PAN validation hooks)
- Document management (upload, storage, metadata; S3-compatible; checksum; retention)
- Customer lifecycle (onboard → maintain → freeze/close)
- Audit trails + approval workflow (maker-checker)
- API contracts frozen; OpenAPI published
- Acceptance: 50+ API tests, 10+ E2E flows, security checklist passed

2) TransactionService v1 (Minimal viable ledger)
- Double-entry ledger model (accounts, journal, postings, balances)
- Posting engine with idempotency + concurrency controls
- Balance projections and holds
- Reversal/correction flows; audit trails
- Acceptance: 100+ unit tests on postings; 1,000 txn/min on dev infra; consistency checks

3) InterestFeeService v1 (Accrual basics)
- Daily accrual engine for savings/current
- Monthly apply + TDS computation hooks
- Expression-based rate selection
- Acceptance: deterministic test vectors, backdated runs, idempotent reruns

4) Platform baseline
- Central authN/Z (JWT, roles, service-to-service)
- Centralized logging (structured), tracing (OpenTelemetry), metrics (Prometheus)
- Hardening: rate limiting, request validation, secrets hygiene, threat model basics

5) Pilots & GTM
- Select 2 UCBs for pilot (Maharashtra + Karnataka)
- Demo packs: reference datasets, scripts, and dashboards
- Commercials: pilot SOW, pricing (₹25–60L implementation + ₹2–5L/mo)

### KPIs (90 days)
- 2 pilots signed (LOI + kickoff)
- 3 services productionized (CS, TS, IF)
- 80% line coverage on critical paths
- <200ms p95 for read APIs; <500ms postings p95
- Security baseline passed (OWASP ASVS L1 subset)

### Hiring (90 days)
- +6 engineers: 2 backend (.NET), 1 systems (perf), 1 QA automation, 1 DevOps, 1 BA (banking)

---

## 📅 Year 1 Plan (Jan–Dec 2026)
Theme: Core completeness + 10–15 production customers.

### Q1 (Jan–Mar 2026)
- AccountService v1: lifecycle, statements, joint/nominee, freeze/unfreeze
- ReportingMIS v1: operational reports, audit exports
- WorkflowOrchestration v1: persisted state, SLA timers, events
- Compliance v0.9: RBI reporting skeleton, audit log immutability
- KPI: 3 pilots live; 5 paying customers; 1M postings/month sustained

### Q2 (Apr–Jun 2026)
- LoanService v1: origination → disbursement → EMI schedule; prepayment/foreclosure
- DocumentManagement v1: retention/legal holds; full-text search
- APIGateway v1: authN/Z, rate limits, caching, canary flags
- KPI: 8–10 paying customers; ₹6–8 Cr ARR run-rate; 3M postings/month

### Q3 (Jul–Sep 2026)
- Payments Integrations: IMPS/NEFT rails via partner; file-based RTGS
- Reconciliation & disputes; exception handling framework
- Analytics foundation: star schema + CDC into warehouse (BigQuery/Redshift)
- KPI: 12–15 customers; Uptime 99.9%; <0.01% posting mismatches

### Q4 (Oct–Dec 2026)
- Multitenancy hardening: tenant isolation (data + rate limits + quotas)
- Performance & scale: 500 TPS postings, soak and chaos tests
- Security: ISO 27001 audit readiness; SOC2-lite controls
- KPI: 15+ customers; ₹12–15 Cr ARR; DR drills passed (RPO<=5m, RTO<=1h)

---

## 📅 Year 2 Plan (Jan–Dec 2027)
Theme: Product breadth + national scale (40–60 customers).

### Q1 (Jan–Mar 2027)
- UPI/BBPS integration via NPCI-approved partner
- Risk & fraud rules: expression-driven + velocity checks
- Treasury/GL bridge: export to GLAccounting; daily trial balances
- KPI: 25 customers; ₹25 Cr ARR; 99.95% uptime

### Q2 (Apr–Jun 2027)
- Collections & NPA flows; legal notice automation
- Fees & pricing engine (tiered slabs; campaigns)
- Data privacy & retention automation (DLP, RTBF workflows)
- KPI: 35 customers; ₹40 Cr ARR; ISO 27001 certified

### Q3 (Jul–Sep 2027)
- Regionalization: languages, tax nuances, state co-op norms
- Partner marketplace (plugins: GST, CKYC, CKYCR, PAN NSDL checks)
- Sandbox for SIs; certification program
- KPI: 45 customers; ₹55 Cr ARR; <100 ms read p95 at 10x scale

### Q4 (Oct–Dec 2027)
- Performance tier upgrade (horizontal scaling, partitioned ledger)
- Advanced analytics: cohort, churn, profitability; anomaly detection
- KPI: 60 customers; ₹75 Cr ARR; audit zero high-risk findings

---

## 📅 Year 3 Plan (Jan–Dec 2028)
Theme: Category leadership (100+ customers) + optional international.

### Q1 (Jan–Mar 2028)
- Internationalization pilot (SAARC market): currency, locales, compliance adapters
- Card switch integration (RuPay) for select use-cases
- KPI: 75 customers; ₹100 Cr ARR

### Q2 (Apr–Jun 2028)
- Full GLAccounting module (double-entry with financial reporting)
- Liquidity & ALM reporting pack; stress scenarios
- KPI: 85 customers; ₹120 Cr ARR

### Q3 (Jul–Sep 2028)
- AI copilots: ops automation (recon suggestions, dispute triage)
- Low-code journey builder (forms + workflow + rules packaged)
- KPI: 95 customers; ₹140 Cr ARR

### Q4 (Oct–Dec 2028)
- Ecosystem scale: channel partners in 10+ states; standardized migrations
- IPO/Series C readiness: SOC2 Type II, IRAP-like controls
- KPI: 110 customers; ₹160–200 Cr ARR

---

## 📦 Quarterly Deliverables (Every 3 Months)
- 1–2 modules to production-grade (bank-usable, documented, tested)
- 1 integration delivered (payments, KYC, docs, analytics, or fraud)
- Reliability hardening sprint (perf, security, observability)
- Sales enablement pack (demo data, scripts, ROI calculator)
- Pilot/customer milestones (go-live or expansion)

---

## 🧮 Budget & Team (India Costs, indicative)
- Year 1 burn: ₹12–18 Cr (team 25–35; infra + compliance included)
- Year 2 burn: ₹20–28 Cr (team 40–55; integrations + certifications)
- Year 3 burn: ₹28–36 Cr (team 55–70; analytics + international)

---

## ⚠️ Risks & Mitigations
- Ledger correctness: build deterministic tests + shadow ledgers before cutover
- Performance surprises: capacity modeling; chaos/soak monthly
- Regulatory changes: compliance watchlist; configurable reporting
- Sales cycle length: pilots with SIs; gov/association endorsements
- Talent: hire senior core team early; grow with academy model

---

## 🧭 Roadmap Principles
- Value-first: prioritize modules that unlock revenue (CS, TS, Loans, Interest)
- Expression-first: push rules, pricing, eligibility into engine for agility
- Proof-before-scale: pilots → references → regional scale
- Secure-by-default: auth, audit, rate limits, observability baseline

---

## ✅ Acceptance Criteria Definition (per module)
- Test coverage: 80% lines, 90% critical paths
- Load: proven at 10× projected peak for 1 hour (no data loss)
- Security: OWASP ASVS L2 for exposed APIs; secrets managed
- Docs: API + runbooks + migration playbook
- Operability: dashboards, alerts, SLOs, DR drill scripts

---

## 📣 What to Tell Investors/Customers
- 90 days: 3 production modules + 2 pilots
- 12 months: full core set for UCB/NBFC + 15 customers
- 24 months: nationwide scale + payments + compliance certification
- 36 months: category leader with 100+ customers, ₹160–200 Cr ARR

# CLAUDE.md — SaaR Core Banking Services

Persistent instructions for Claude Code in this repository.

---

## Standing Instructions

### Auto-update tracking documents
After completing any meaningful task (feature, fix, refactor, commit, or milestone change), always update the following files without waiting to be asked:

- **CONTEXT.md** — move completed items into Completed, update In Progress, update Pending Next
- **PROJECT_STATE.md** — update Last Updated date, Recent Work Done (with commit hash), Pending Work, and Next Recommended Steps
- **TASK_QUEUE.md** — update Current Focus, move done items to Recently Completed (with commit hash and date), update High/Medium/Low priority lists
- **DECISIONS_LOG.md** — add an entry only if a genuine architectural or design decision was made; skip trivial implementation choices

You have full permission to edit all four of these files at any time.

### Commit after each logical unit of work
After completing a task and updating the tracking docs, stage and commit all changes together. Do not leave work uncommitted.

### Git identity for this repo
- Name: `saaritsolutions`
- Email: `githubsaarit@gmail.com`

---

## Project Quick Reference

**Stack:** .NET 8 microservices + React 19 (primary frontend) + PostgreSQL + Roslyn expression engine + OpenAI GPT

**Dev ports:**
| Service | Port |
|---|---|
| ExpressionBuilderService | 5004 |
| WorkflowOrchestrationService | 5012 |
| DynamicFieldsSchemaService | 5013 |
| LoanService | 5130 |
| frontend-react | 3002 |

**Active expression ID (do not delete):** `EXPR_1755237353842`

**Start all services:** `./start-all.sh` or `./saar-core-banking-services/scripts/start-all.sh`

**Required env var:** `ASPNETCORE_ENVIRONMENT=Development` for feature flags, CORS, and Swagger

**All new UI work** goes into `saar-core-banking-services/frontend-react/`. The Angular frontend (`frontend-ui/`) is not actively maintained.

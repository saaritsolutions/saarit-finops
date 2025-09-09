# Fixed ports reference

Use these ports for local dev and demos. If a port is in use, kill the blocker and start on the same port.

- ExpressionBuilderService: http://localhost:5004
- WorkflowOrchestrationService: http://localhost:5012
- DynamicFieldsSchemaService: http://localhost:5013
- LoanService: http://localhost:5130
- Frontend (React dev): http://localhost:3002 (CRA may auto-bump if busy)

## Scripts

- scripts/kill-port.sh 5004 — free a port
- scripts/run-fixed-port.sh <service-dir> <port> [--watch] — kill then run on that port
- scripts/start-all.sh — launch all backend services on fixed ports

## Notes

- Services also honor ASPNETCORE_URLS; scripts pass `--urls` explicitly for consistency.
- Keep Swagger enabled for demos at /swagger on each service.

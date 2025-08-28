#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGDIR="$ROOT/logs"
mkdir -p "$LOGDIR"

# Start ExpressionBuilderService (if project exists), otherwise start the local stub
if [ -f "$ROOT/saar-core-banking-services/ExpressionBuilderService/ExpressionBuilderService.csproj" ]; then
  echo "Starting ExpressionBuilderService..."
  (cd "$ROOT/saar-core-banking-services/ExpressionBuilderService" && dotnet run --project ExpressionBuilderService.csproj) >"$LOGDIR/expression.log" 2>&1 &
  echo "$!" > "$LOGDIR/expression.pid"
else
  echo "ExpressionBuilderService project not found, starting stub on port 5004"
  (python3 "$ROOT/stub_expression_service.py") >"$LOGDIR/expression_stub.log" 2>&1 &
  echo "$!" > "$LOGDIR/expression.pid"
fi

# Start WorkflowOrchestrationService if present
if [ -f "$ROOT/saar-core-banking-services/WorkflowOrchestrationService/WorkflowOrchestrationService.csproj" ]; then
  echo "Starting WorkflowOrchestrationService..."
  (cd "$ROOT/saar-core-banking-services/WorkflowOrchestrationService" && dotnet run --project WorkflowOrchestrationService.csproj) >"$LOGDIR/workflow.log" 2>&1 &
  echo "$!" > "$LOGDIR/workflow.pid"
else
  echo "WorkflowOrchestrationService not found — skipping"
fi

# Start DynamicFieldsSchemaService if present
if [ -f "$ROOT/saar-core-banking-services/DynamicFieldsSchemaService/DynamicFieldsSchemaService.csproj" ]; then
  echo "Starting DynamicFieldsSchemaService..."
  (cd "$ROOT/saar-core-banking-services/DynamicFieldsSchemaService" && dotnet run --project DynamicFieldsSchemaService.csproj) >"$LOGDIR/forms.log" 2>&1 &
  echo "$!" > "$LOGDIR/forms.pid"
else
  echo "DynamicFieldsSchemaService not found — skipping"
fi

# Start LoanService
if [ -f "$ROOT/saar-core-banking-services/LoanService/LoanService.csproj" ]; then
  echo "Starting LoanService..."
  (cd "$ROOT/saar-core-banking-services/LoanService" && dotnet run --project LoanService.csproj) >"$LOGDIR/loanservice.log" 2>&1 &
  echo "$!" > "$LOGDIR/loanservice.pid"
else
  echo "LoanService project not found — aborting"
  exit 1
fi

sleep 1

echo "All services started (PIDs):"
[ -f "$LOGDIR/expression.pid" ] && echo "Expression: $(cat $LOGDIR/expression.pid)"
[ -f "$LOGDIR/workflow.pid" ] && echo "Workflow: $(cat $LOGDIR/workflow.pid)"
[ -f "$LOGDIR/forms.pid" ] && echo "Forms: $(cat $LOGDIR/forms.pid)"
[ -f "$LOGDIR/loanservice.pid" ] && echo "LoanService: $(cat $LOGDIR/loanservice.pid)"

echo "Tailing last 50 lines of loanservice log"
 tail -n 50 "$LOGDIR/loanservice.log" || true

echo "Logs are in $LOGDIR"

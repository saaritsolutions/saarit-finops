#!/usr/bin/env bash
# Start all microservices on fixed ports, killing blockers first.
# Ports (canonical):
# - ExpressionBuilderService: 5004
# - TransactionService: 5005
# - WorkflowOrchestrationService: 5012
# - DynamicFieldsSchemaService: 5013
# - AccountService: 5217
# - LoanService: 5130
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
SVC_DIR() { echo "$ROOT_DIR/$1"; }

"$ROOT_DIR/scripts/run-fixed-port.sh" "$(SVC_DIR ExpressionBuilderService)" 5004 --watch &
EXP_PID=$!
"$ROOT_DIR/scripts/run-fixed-port.sh" "$(SVC_DIR TransactionService)" 5005 --watch &
TXN_PID=$!
"$ROOT_DIR/scripts/run-fixed-port.sh" "$(SVC_DIR WorkflowOrchestrationService)" 5012 --watch &
WF_PID=$!
"$ROOT_DIR/scripts/run-fixed-port.sh" "$(SVC_DIR DynamicFieldsSchemaService)" 5013 --watch &
DFS_PID=$!
"$ROOT_DIR/scripts/run-fixed-port.sh" "$(SVC_DIR AccountService)" 5217 --watch &
ACC_PID=$!
"$ROOT_DIR/scripts/run-fixed-port.sh" "$(SVC_DIR LoanService)" 5130 --watch &
LOAN_PID=$!

trap 'echo "Stopping services..."; kill $EXP_PID $TXN_PID $WF_PID $DFS_PID $ACC_PID $LOAN_PID 2>/dev/null || true; wait' INT TERM

echo "Services started: EXP($EXP_PID) TXN($TXN_PID) WF($WF_PID) DFS($DFS_PID) ACC($ACC_PID) LOAN($LOAN_PID)"
wait

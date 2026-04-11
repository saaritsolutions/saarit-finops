@echo off
REM ============================================================
REM  run-smoke.bat
REM  Runs the SaaR Smoke Suite — all modules, fast, ~3 min.
REM
REM  Usage (from cmd.exe):
REM    scripts\run-smoke.bat
REM
REM  Modules covered:
REM    Auth, Dashboard, Accounts, Loans, Transactions,
REM    Customers, Users, Expression Builder, Reports,
REM    + API health checks for all 5 services.
REM
REM  All API calls are intercepted with stubs, so no backend
REM  services need to be running (except for the health checks).
REM
REM  IMPORTANT: Must be run from cmd.exe, NOT Git Bash.
REM ============================================================

set ROOT=%~dp0..
set FRONTEND_DIR=%ROOT%
set SPEC_FILTER=cypress/e2e/smoke.cy.ts

echo.
echo ====================================================
echo  SaaR Banking — SMOKE SUITE
echo  Spec: %SPEC_FILTER%
echo ====================================================
echo.

REM Start React if not already running
echo [1/2] Starting React frontend (port 3002)...
start "React Frontend" cmd /k "cd /d %FRONTEND_DIR% && set PORT=3002 && set BROWSER=none && set REACT_APP_VERSION=dev && node_modules\.bin\craco start"

echo Waiting 22 seconds for React to compile...
timeout /t 22 /nobreak > nul

echo.
echo [2/2] Running Smoke Suite...
cd /d %FRONTEND_DIR%
npx cypress run --spec "%SPEC_FILTER%" --headless

echo.
echo ====================================================
echo  Smoke run complete.  Exit code: %ERRORLEVEL%
echo  Videos: cypress\videos\
echo ====================================================
pause

@echo off
REM ============================================================
REM  run-regression.bat
REM  Runs the SaaR Regression Suite — full module coverage.
REM
REM  Usage (from cmd.exe):
REM    scripts\run-regression.bat              <- all regression specs
REM    scripts\run-regression.bat 03-accounts  <- one module only
REM
REM  Regression specs (in cypress\e2e\regression\):
REM    01-auth.cy.ts
REM    02-dashboard.cy.ts
REM    03-accounts.cy.ts        (list, create, freeze, mature)
REM    04-loans.cy.ts           (list, detail, new form, steps)
REM    05-transactions.cy.ts    (ledger, journal, post entry)
REM    06-customers.cy.ts       (list, search, create, KYC)
REM    07-users.cy.ts           (users tab, roles tab, add user)
REM    08-expression-builder.cy.ts (list, create, execute)
REM
REM  All API calls use cy.intercept() stubs — no live backends needed.
REM  For real-API mode, set CYPRESS_BASE_URL and start all services first.
REM
REM  IMPORTANT: Must be run from cmd.exe, NOT Git Bash.
REM ============================================================

set ROOT=%~dp0..
set FRONTEND_DIR=%ROOT%

REM Spec filter: all regression specs OR one specific module
set SPEC_FILTER=cypress/e2e/regression/*.cy.ts
if not "%~1"=="" set SPEC_FILTER=cypress/e2e/regression/%~1.cy.ts

echo.
echo ====================================================
echo  SaaR Banking — REGRESSION SUITE
echo  Spec: %SPEC_FILTER%
echo ====================================================
echo.

REM Start React if not already running
REM REACT_APP_DISABLE_DEV_AUTH=true disables the dev-mode auto-auth bypass so the
REM login form renders normally for the 01-auth.cy.ts regression tests.
REM cy.loginAsDemo() still works because it sets a mock-jwt-token-* in localStorage
REM which authSlice accepts via the isMockToken check.
echo [1/2] Starting React frontend (port 3002)...
start "React Frontend" cmd /k "cd /d %FRONTEND_DIR% && set PORT=3002 && set BROWSER=none && set REACT_APP_VERSION=dev && set REACT_APP_DISABLE_DEV_AUTH=true && node_modules\.bin\craco start"

echo Waiting 22 seconds for React to compile...
timeout /t 22 /nobreak > nul

echo.
echo [2/2] Running Regression Suite: %SPEC_FILTER%
cd /d %FRONTEND_DIR%
npx cypress run --spec "%SPEC_FILTER%" --headless

echo.
echo ====================================================
echo  Regression run complete.  Exit code: %ERRORLEVEL%
echo  Videos: cypress\videos\
echo ====================================================
pause

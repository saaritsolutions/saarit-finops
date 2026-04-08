@echo off
REM ============================================================
REM  run-cypress-headless.bat
REM  Runs Cypress E2E tests in headless mode (no GUI).
REM
REM  Usage:
REM    run-cypress-headless.bat                  <- all specs
REM    run-cypress-headless.bat smoke-check      <- specific spec name
REM    run-cypress-headless.bat loan-workflow-ui <- specific spec name
REM
REM  IMPORTANT: Must be run from cmd.exe (not Git Bash).
REM  Cypress Electron binary fails with "bad option: --smoke-test"
REM  when launched from Git Bash on this machine.
REM ============================================================

set ROOT=%~dp0..
set EXPR_DIR=%ROOT%\..\ExpressionBuilderService
set FRONTEND_DIR=%ROOT%

REM ---- spec filter (optional first argument) ------------------
set SPEC_FILTER=cypress/e2e/**/*.cy.ts
if not "%~1"=="" set SPEC_FILTER=cypress/e2e/%~1.cy.ts

echo.
echo [1/3] Starting ExpressionBuilderService (port 5004, in-memory DB)...
start "ExpressionBuilderService" cmd /k "cd /d %EXPR_DIR% && set ASPNETCORE_ENVIRONMENT=Development && set EXPR_USE_INMEMORY_DB=1 && dotnet run --urls http://localhost:5004"

echo Waiting 14 seconds for service to start...
timeout /t 14 /nobreak > nul

echo.
echo [2/3] Starting React frontend (port 3002)...
start "React Frontend" cmd /k "cd /d %FRONTEND_DIR% && set PORT=3002 && set BROWSER=none && set REACT_APP_VERSION=dev && node_modules\.bin\craco start"

echo Waiting 20 seconds for React to compile...
timeout /t 20 /nobreak > nul

echo.
echo [3/3] Running Cypress headless: %SPEC_FILTER%
cd /d %FRONTEND_DIR%
npx cypress run --spec "%SPEC_FILTER%" --headless

echo.
echo ============================================================
echo  Cypress run complete.  Exit code: %ERRORLEVEL%
echo  Videos saved to: cypress\videos\
echo ============================================================
pause

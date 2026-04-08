@echo off
REM ============================================================
REM  open-cypress.bat
REM  Starts ExpressionBuilderService + React frontend, then
REM  opens Cypress in interactive GUI mode.
REM
REM  Run this from Windows cmd or double-click it.
REM  Cypress cannot start from Git Bash on this machine —
REM  use this .bat file instead.
REM ============================================================

set ROOT=%~dp0..
set EXPR_DIR=%ROOT%\..\ExpressionBuilderService
set FRONTEND_DIR=%ROOT%

echo.
echo [1/3] Starting ExpressionBuilderService (port 5004, in-memory DB)...
start "ExpressionBuilderService" cmd /k "cd /d %EXPR_DIR% && set ASPNETCORE_ENVIRONMENT=Development && set EXPR_USE_INMEMORY_DB=1 && dotnet run --urls http://localhost:5004"

echo Waiting 12 seconds for service to start...
timeout /t 12 /nobreak > nul

echo.
echo [2/3] Starting React frontend (port 3002)...
start "React Frontend" cmd /k "cd /d %FRONTEND_DIR% && set PORT=3002 && npm start"

echo Waiting 15 seconds for React to compile...
timeout /t 15 /nobreak > nul

echo.
echo [3/3] Opening Cypress GUI...
cd /d %FRONTEND_DIR%
npx cypress open

echo.
echo Cypress closed. You can close the other windows manually.
pause

@echo off
cd /d "%~dp0"
echo Starting Tink 2.0 (Development Version)...
echo This version has better access to Node.js modules
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

REM Launch the development version
echo Launching Tink 2.0...
npm start 
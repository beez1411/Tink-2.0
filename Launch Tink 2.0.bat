@echo off
cd /d "%~dp0"
echo Starting Tink 2.0 (Production Version)...
echo.

REM Check if the built executable exists
if not exist "dist\win-unpacked\Tink 2.0.exe" (
    echo ERROR: Built executable not found!
    echo Please run 'npm run build' to create the built version first.
    pause
    exit /b 1
)

REM Launch the built version
start "" "dist\win-unpacked\Tink 2.0.exe"
echo Tink 2.0 launched successfully! 
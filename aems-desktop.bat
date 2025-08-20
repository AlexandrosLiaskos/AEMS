@echo off
title AEMS - Agentic Email Management System

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Change to the directory where this batch file is located
cd /d "%~dp0"

REM Check if desktop-app.js exists
if not exist "desktop-app.js" (
    echo.
    echo ERROR: desktop-app.js not found in current directory
    echo Please make sure you're running this from the AEMS directory
    echo.
    pause
    exit /b 1
)

REM Start AEMS in desktop mode
echo Starting AEMS Desktop Application...
echo.
node desktop-app.js

REM If we get here, the application has stopped
echo.
echo AEMS has stopped.
pause

@echo off
setlocal enabledelayedexpansion

REM Set working directory to batch file location
cd /d "%~dp0"

echo Starting Anime Guessr...

REM Check if executable exists
if not exist "dist\anime-guessr.exe" (
    echo Error: anime-guessr.exe not found!
    echo Please run 'npm run build' first.
    pause
    exit /b 1
)

REM Run the application
"dist\anime-guessr.exe"

if errorlevel 1 (
    echo Application closed with error.
    pause
    exit /b 1
)

pause
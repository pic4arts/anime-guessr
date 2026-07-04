@echo off
setlocal enabledelayedexpansion

REM Set working directory to batch file location
cd /d "%~dp0"

echo Starting Anime Guessr...

REM Prefer the current source version during development.
where node >nul 2>&1
if not errorlevel 1 (
    if exist "node_modules\express\package.json" (
        echo Starting current source version...
        node start.js
        exit /b !errorlevel!
    )
)

REM Fall back to the packaged release when Node.js or dependencies are unavailable.
if not exist "dist\anime-guessr.exe" (
    echo Error: anime-guessr.exe not found!
    echo Please run 'npm install' first.
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

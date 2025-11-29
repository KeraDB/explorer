@echo off
echo ================================================
echo NoSQLite Labs - Windows Build Script
echo ================================================
echo.

cd /d D:\TopSecret\nosqlite\nosqlite-labs

echo [1/4] Checking prerequisites...
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm not found. Please install Node.js
    pause
    exit /b 1
)

where cargo >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: cargo not found. Please install Rust from https://rustup.rs
    pause
    exit /b 1
)

echo     - Node.js: OK
echo     - Rust: OK
echo.

echo [2/4] Installing dependencies...
cd frontend
call npm install
cd ..

echo.
echo [3/4] Building frontend...
cd frontend
call npm run build
cd ..

echo.
echo [4/4] Building Tauri Windows executable...
call npm run build

echo.
echo ================================================
echo Build Complete!
echo ================================================
echo.
echo Executable location:
dir /s /b src-tauri\target\release\*.exe 2>nul
echo.
echo MSI Installer location:
dir /s /b src-tauri\target\release\bundle\msi\*.msi 2>nul
echo.
pause

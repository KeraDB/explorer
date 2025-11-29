@echo off
echo ================================================
echo NoSQLite Labs - Windows Build Status
echo ================================================
echo.

REM Check for the exe file
if exist "src-tauri\target\release\nosqlite-labs.exe" (
    echo [SUCCESS] EXE FILE FOUND!
    echo.
    echo Location: src-tauri\target\release\nosqlite-labs.exe
    dir "src-tauri\target\release\nosqlite-labs.exe"
    echo.
    echo You can run it with: .\src-tauri\target\release\nosqlite-labs.exe
) else (
    echo [PENDING] EXE not found yet - still building...
)

echo.
echo ================================================
echo Checking for MSI Installer...
echo ================================================
echo.

if exist "src-tauri\target\release\bundle\msi\*.msi" (
    echo [SUCCESS] MSI INSTALLER FOUND!
    echo.
    dir "src-tauri\target\release\bundle\msi\*.msi"
) else (
    echo [PENDING] MSI installer not ready yet
)

echo.
echo ================================================
echo Full bundle directory:
echo ================================================

if exist "src-tauri\target\release\bundle" (
    dir /s "src-tauri\target\release\bundle"
) else (
    echo Bundle directory doesn't exist yet
)

echo.
pause

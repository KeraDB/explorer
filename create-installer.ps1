# NoSQLite Labs - Windows Installer Creator
# This script creates a Windows installer package

param(
    [string]$Version = "1.0.0",
    [string]$OutputDir = ".\installer-output"
)

Write-Host "🔧 NoSQLite Labs Installer Creator" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Check if exe exists
$exePath = ".\src-tauri\target\release\nosqlite-labs.exe"
if (-not (Test-Path $exePath)) {
    Write-Host "❌ Error: nosqlite-labs.exe not found!" -ForegroundColor Red
    Write-Host "   Please run 'npm run build' first to create the executable." -ForegroundColor Yellow
    exit 1
}

# Get exe info
$exeInfo = Get-ChildItem $exePath
Write-Host "✅ Found executable:" -ForegroundColor Green
Write-Host "   File: $($exeInfo.Name)" -ForegroundColor White
Write-Host "   Size: $([math]::Round($exeInfo.Length / 1MB, 2)) MB" -ForegroundColor White
Write-Host "   Modified: $($exeInfo.LastWriteTime)" -ForegroundColor White

# Create output directory
Write-Host "`n📁 Creating installer directory..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Copy executable
Write-Host "📋 Copying files..." -ForegroundColor Cyan
Copy-Item $exePath "$OutputDir\nosqlite-labs.exe" -Force

# Copy icons
$iconPath = ".\src-tauri\icons\icon.ico"
if (Test-Path $iconPath) {
    Copy-Item $iconPath "$OutputDir\nosqlite-labs.ico" -Force
    Write-Host "   ✅ Icon copied" -ForegroundColor Green
}

# Create README for installer
$readmeContent = @"
# NoSQLite Labs v$Version

## Installation Instructions

1. Copy `nosqlite-labs.exe` to your desired installation directory (e.g., `C:\Program Files\NoSQLite Labs\`)
2. Create a desktop shortcut if desired
3. Run the application by double-clicking `nosqlite-labs.exe`

## Features

- Desktop NoSQL database management
- File-based databases (.ndb format)
- Native Windows integration
- Fast performance with native UI

## System Requirements

- Windows 10/11
- WebView2 Runtime (usually pre-installed)
- 50MB free disk space

## Uninstallation

Simply delete the installation directory and any shortcuts created.

Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@

Set-Content "$OutputDir\README.txt" $readmeContent

# Create batch installer
$installerBat = @"
@echo off
title NoSQLite Labs Installer
echo.
echo ========================================
echo  NoSQLite Labs v$Version Installer
echo ========================================
echo.

set "INSTALL_DIR=%ProgramFiles%\NoSQLite Labs"
set "DESKTOP=%USERPROFILE%\Desktop"

echo Installing to: %INSTALL_DIR%
echo.

REM Create installation directory
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Copy files
echo Copying application files...
copy /Y "nosqlite-labs.exe" "%INSTALL_DIR%\"
if exist "nosqlite-labs.ico" copy /Y "nosqlite-labs.ico" "%INSTALL_DIR%\"
copy /Y "README.txt" "%INSTALL_DIR%\"

REM Create desktop shortcut
echo Creating desktop shortcut...
powershell -Command "^
`$WshShell = New-Object -comObject WScript.Shell; ^
`$Shortcut = `$WshShell.CreateShortcut('%DESKTOP%\NoSQLite Labs.lnk'); ^
`$Shortcut.TargetPath = '%INSTALL_DIR%\nosqlite-labs.exe'; ^
`$Shortcut.WorkingDirectory = '%INSTALL_DIR%'; ^
`$Shortcut.IconLocation = '%INSTALL_DIR%\nosqlite-labs.ico'; ^
`$Shortcut.Description = 'NoSQLite Labs - Desktop Database Management'; ^
`$Shortcut.Save()"

echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo Application installed to: %INSTALL_DIR%
echo Desktop shortcut created: %DESKTOP%\NoSQLite Labs.lnk
echo.
echo Press any key to launch NoSQLite Labs...
pause >nul

start "" "%INSTALL_DIR%\nosqlite-labs.exe"
"@

Set-Content "$OutputDir\install.bat" $installerBat

# Create PowerShell installer (more advanced)
$installerPs1 = @"
# NoSQLite Labs PowerShell Installer
param(
    [string]`$InstallPath = "`$env:ProgramFiles\NoSQLite Labs",
    [switch]`$CreateShortcut = `$true,
    [switch]`$AddToPath = `$false
)

Write-Host "🚀 Installing NoSQLite Labs v$Version..." -ForegroundColor Cyan

# Check admin rights for Program Files installation
if (`$InstallPath.StartsWith(`$env:ProgramFiles) -and -not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "❌ Administrator rights required for installation to Program Files" -ForegroundColor Red
    Write-Host "   Please run PowerShell as Administrator or choose a different install path" -ForegroundColor Yellow
    exit 1
}

# Create installation directory
Write-Host "📁 Creating installation directory: `$InstallPath" -ForegroundColor Green
New-Item -ItemType Directory -Path `$InstallPath -Force | Out-Null

# Copy files
Write-Host "📋 Copying application files..." -ForegroundColor Green
Copy-Item "nosqlite-labs.exe" "`$InstallPath\" -Force
if (Test-Path "nosqlite-labs.ico") { Copy-Item "nosqlite-labs.ico" "`$InstallPath\" -Force }
Copy-Item "README.txt" "`$InstallPath\" -Force

# Create desktop shortcut
if (`$CreateShortcut) {
    Write-Host "🔗 Creating desktop shortcut..." -ForegroundColor Green
    `$WshShell = New-Object -comObject WScript.Shell
    `$Shortcut = `$WshShell.CreateShortcut("`$env:USERPROFILE\Desktop\NoSQLite Labs.lnk")
    `$Shortcut.TargetPath = "`$InstallPath\nosqlite-labs.exe"
    `$Shortcut.WorkingDirectory = `$InstallPath
    `$Shortcut.IconLocation = "`$InstallPath\nosqlite-labs.ico"
    `$Shortcut.Description = "NoSQLite Labs - Desktop Database Management"
    `$Shortcut.Save()
}

# Add to PATH (optional)
if (`$AddToPath) {
    Write-Host "🛤️ Adding to system PATH..." -ForegroundColor Green
    `$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if (`$currentPath -notlike "*`$InstallPath*") {
        [Environment]::SetEnvironmentVariable("PATH", "`$currentPath;`$InstallPath", "User")
    }
}

Write-Host "`n✅ Installation completed successfully!" -ForegroundColor Green
Write-Host "   📍 Installed to: `$InstallPath" -ForegroundColor White
Write-Host "   🖥️ Desktop shortcut: `$env:USERPROFILE\Desktop\NoSQLite Labs.lnk" -ForegroundColor White
Write-Host "`n🚀 Ready to launch NoSQLite Labs!" -ForegroundColor Cyan
"@

Set-Content "$OutputDir\install.ps1" $installerPs1

# Create uninstaller
$uninstallerBat = @"
@echo off
title NoSQLite Labs Uninstaller
echo.
echo ========================================
echo  NoSQLite Labs Uninstaller
echo ========================================
echo.

set "INSTALL_DIR=%ProgramFiles%\NoSQLite Labs"
set "DESKTOP=%USERPROFILE%\Desktop"

echo This will remove NoSQLite Labs from your computer.
echo Installation directory: %INSTALL_DIR%
echo.
set /p confirm="Are you sure you want to uninstall? (Y/N): "

if /i "%confirm%" NEQ "Y" (
    echo Uninstallation cancelled.
    pause
    exit /b
)

echo.
echo Removing files...

REM Remove desktop shortcut
if exist "%DESKTOP%\NoSQLite Labs.lnk" del "%DESKTOP%\NoSQLite Labs.lnk"

REM Remove installation directory
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%"
    echo Installation directory removed.
) else (
    echo Installation directory not found.
)

echo.
echo ========================================
echo  Uninstallation Complete!
echo ========================================
echo.
echo NoSQLite Labs has been removed from your computer.
pause
"@

Set-Content "$OutputDir\uninstall.bat" $uninstallerBat

# Create package info
$packageInfo = @{
    name = "nosqlite-labs"
    version = $Version
    description = "NoSQLite Labs - Desktop NoSQL Database Management"
    executable = "nosqlite-labs.exe"
    size_mb = [math]::Round($exeInfo.Length / 1MB, 2)
    created = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    platform = "Windows x64"
    requirements = @("Windows 10/11", "WebView2 Runtime")
}

$packageInfo | ConvertTo-Json -Depth 2 | Set-Content "$OutputDir\package.json"

Write-Host "`n🎉 Installer package created successfully!" -ForegroundColor Green
Write-Host "📦 Package location: $OutputDir" -ForegroundColor White
Write-Host "`nPackage contents:" -ForegroundColor Cyan
Get-ChildItem $OutputDir | Format-Table Name, Length, LastWriteTime -AutoSize

Write-Host "`n🚀 Installation options:" -ForegroundColor Yellow
Write-Host "   1. Simple: Run install.bat (requires admin)" -ForegroundColor White
Write-Host "   2. Advanced: Run install.ps1 (PowerShell)" -ForegroundColor White
Write-Host "   3. Manual: Copy nosqlite-labs.exe anywhere" -ForegroundColor White

Write-Host "`n✅ Ready to distribute!" -ForegroundColor Green
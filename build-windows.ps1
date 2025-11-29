# NoSQLite Labs - Windows Build Script (PowerShell)
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "NoSQLite Labs - Windows .exe Builder" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "D:\TopSecret\nosqlite\nosqlite-labs"

# Check prerequisites
Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Yellow

$npmExists = Get-Command npm -ErrorAction SilentlyContinue
$cargoExists = Get-Command cargo -ErrorAction SilentlyContinue

if (-not $npmExists) {
    Write-Host "ERROR: npm not found. Install Node.js from https://nodejs.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not $cargoExists) {
    Write-Host "ERROR: cargo not found. Install Rust from https://rustup.rs" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "    ✓ Node.js found" -ForegroundColor Green
Write-Host "    ✓ Rust found" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "[2/4] Installing npm dependencies..." -ForegroundColor Yellow
Set-Location "frontend"
npm install
Set-Location ".."
Write-Host ""

# Build frontend
Write-Host "[3/4] Building frontend..." -ForegroundColor Yellow
Set-Location "frontend"
npm run build
Set-Location ".."
Write-Host ""

# Build Tauri
Write-Host "[4/4] Building Windows executable (this may take 5-10 minutes)..." -ForegroundColor Yellow
npm run build

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Find and display the exe
$exePath = Get-ChildItem -Path "src-tauri\target\release" -Filter "nosqlite-labs.exe" -ErrorAction SilentlyContinue
if ($exePath) {
    Write-Host "✓ Executable created:" -ForegroundColor Green
    Write-Host "  $($exePath.FullName)" -ForegroundColor White
    Write-Host "  Size: $([math]::Round($exePath.Length / 1MB, 2)) MB" -ForegroundColor White
} else {
    Write-Host "Warning: Could not find nosqlite-labs.exe" -ForegroundColor Yellow
}

# Find MSI installer
$msiPath = Get-ChildItem -Path "src-tauri\target\release\bundle\msi" -Filter "*.msi" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($msiPath) {
    Write-Host ""
    Write-Host "✓ MSI Installer created:" -ForegroundColor Green
    Write-Host "  $($msiPath.FullName)" -ForegroundColor White
    Write-Host "  Size: $([math]::Round($msiPath.Length / 1MB, 2)) MB" -ForegroundColor White
}

Write-Host ""
Read-Host "Press Enter to exit"

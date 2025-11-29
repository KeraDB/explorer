# Quick Build and Package Script
# Builds the Tauri app and creates installer package

Write-Host "🏗️ NoSQLite Labs - Build & Package" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found!" -ForegroundColor Red
    Write-Host "   Please run this script from the nosqlite-labs directory" -ForegroundColor Yellow
    exit 1
}

# Step 1: Build the application
Write-Host "`n🔨 Step 1: Building Tauri application..." -ForegroundColor Yellow
Write-Host "This may take 5-15 minutes for the first build..." -ForegroundColor Gray

try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host "❌ Build failed: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Create installer package
Write-Host "`n📦 Step 2: Creating installer package..." -ForegroundColor Yellow

if (Test-Path "src-tauri\target\release\nosqlite-labs.exe") {
    Write-Host "✅ Executable found! Creating installer..." -ForegroundColor Green
    .\create-installer.ps1
} else {
    Write-Host "❌ Executable not found after build!" -ForegroundColor Red
    Write-Host "   Expected: src-tauri\target\release\nosqlite-labs.exe" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n🎉 Build and packaging complete!" -ForegroundColor Green
Write-Host "Ready to distribute the installer package!" -ForegroundColor Cyan
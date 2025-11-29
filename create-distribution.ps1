# NoSQLite Labs - Quick Distribution Package
# This script packages the built executable for easy distribution

Write-Host "📦 Creating distribution package..." -ForegroundColor Cyan

$exePath = ".\src-tauri\target\release\nosqlite-labs.exe"
$distDir = ".\dist-package"

# Check if exe exists
if (-not (Test-Path $exePath)) {
    Write-Host "❌ Error: nosqlite-labs.exe not found!" -ForegroundColor Red
    Write-Host "   Please run build first: npm run build" -ForegroundColor Yellow
    exit 1
}

# Create distribution directory
Write-Host "📁 Creating distribution package..." -ForegroundColor Green
Remove-Item $distDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

# Copy main executable
Copy-Item $exePath "$distDir\nosqlite-labs.exe" -Force
Write-Host "✅ Copied executable" -ForegroundColor Green

# Copy documentation
$docs = @("README.md", "DESKTOP_APP_README.md")
foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Copy-Item $doc $distDir -Force
    }
}

# Create quick start guide
$quickStart = @"
# NoSQLite Labs - Quick Start

## Installation
1. Extract all files to a folder (e.g., C:\NoSQLite Labs\)
2. Double-click nosqlite-labs.exe to launch

## First Use
1. Click "Browse" to open an existing .ndb database file
2. Or click "New" to create a new database
3. Use the Explorer to browse collections and documents
4. Monitor system performance in the System Monitor tab

## Features
- Native Windows desktop application
- File-based NoSQL databases (.ndb format)
- Real-time system monitoring
- Connection history tracking
- Fast document operations (insert, find, update, delete)

## System Requirements
- Windows 10/11 (64-bit)
- WebView2 Runtime (usually pre-installed)
- 50MB free disk space

## Support
For issues or questions, check the README.md file.

Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@

Set-Content "$distDir\QUICK_START.txt" $quickStart

# Create ZIP package
$zipPath = ".\NoSQLite-Labs-Windows.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

try {
    Compress-Archive -Path "$distDir\*" -DestinationPath $zipPath -Force
    Write-Host "✅ Created distribution ZIP: $zipPath" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not create ZIP. Files available in: $distDir" -ForegroundColor Yellow
}

# Show package info
$exeInfo = Get-ChildItem $exePath
Write-Host "`n📋 Package Summary:" -ForegroundColor Cyan
Write-Host "   Executable: nosqlite-labs.exe ($([math]::Round($exeInfo.Length / 1MB, 2)) MB)" -ForegroundColor White
Write-Host "   Package: $distDir" -ForegroundColor White
if (Test-Path $zipPath) {
    $zipInfo = Get-ChildItem $zipPath
    Write-Host "   ZIP File: $zipPath ($([math]::Round($zipInfo.Length / 1MB, 2)) MB)" -ForegroundColor White
}

Write-Host "`n🚀 Ready for distribution!" -ForegroundColor Green
Write-Host "   Share the ZIP file or the dist-package folder" -ForegroundColor Yellow
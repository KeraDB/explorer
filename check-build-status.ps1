# Check Build Status
# Monitors the Tauri build progress

Write-Host "🔍 Checking NoSQLite Labs build status..." -ForegroundColor Cyan

$exePath = ".\src-tauri\target\release\nosqlite-labs.exe"
$msiPath = ".\src-tauri\target\release\bundle\msi\NoSQLite Labs_*.msi"

Write-Host "`nLooking for executable..." -ForegroundColor Yellow
if (Test-Path $exePath) {
    $exe = Get-ChildItem $exePath
    Write-Host "✅ Executable found!" -ForegroundColor Green
    Write-Host "   📍 Location: $($exe.FullName)" -ForegroundColor White
    Write-Host "   📏 Size: $([math]::Round($exe.Length / 1MB, 2)) MB" -ForegroundColor White
    Write-Host "   🕒 Modified: $($exe.LastWriteTime)" -ForegroundColor White
} else {
    Write-Host "⏳ Executable not ready yet" -ForegroundColor Yellow
}

Write-Host "`nLooking for MSI installer..." -ForegroundColor Yellow
$msiFiles = Get-ChildItem ".\src-tauri\target\release\bundle\msi\" -Filter "*.msi" -ErrorAction SilentlyContinue
if ($msiFiles) {
    Write-Host "✅ MSI installer found!" -ForegroundColor Green
    foreach ($msi in $msiFiles) {
        Write-Host "   📍 Location: $($msi.FullName)" -ForegroundColor White
        Write-Host "   📏 Size: $([math]::Round($msi.Length / 1MB, 2)) MB" -ForegroundColor White
        Write-Host "   🕒 Modified: $($msi.LastWriteTime)" -ForegroundColor White
    }
} else {
    Write-Host "⏳ MSI installer not ready yet" -ForegroundColor Yellow
}

Write-Host "`nBuild targets available:" -ForegroundColor Cyan
if (Test-Path ".\src-tauri\target\release\") {
    Get-ChildItem ".\src-tauri\target\release\" -Filter "*.exe" | ForEach-Object {
        Write-Host "   🎯 $($_.Name) ($([math]::Round($_.Length / 1MB, 2)) MB)" -ForegroundColor White
    }
} else {
    Write-Host "   ⏳ Release directory not created yet" -ForegroundColor Yellow
}

# Check if build is currently running
$buildProcesses = Get-Process | Where-Object { $_.ProcessName -like "*cargo*" -or $_.ProcessName -like "*rustc*" -or $_.ProcessName -like "*tauri*" }
if ($buildProcesses) {
    Write-Host "`n🔨 Build appears to be running..." -ForegroundColor Yellow
    Write-Host "Active processes:" -ForegroundColor Gray
    $buildProcesses | Format-Table ProcessName, Id, CPU, WorkingSet -AutoSize
} else {
    Write-Host "`n💤 No active build processes detected" -ForegroundColor Gray
}
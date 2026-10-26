Set-Location "D:\FertiLedger ERP"

Write-Host ""
Write-Host "=== STEP 1: TypeScript Check ===" -ForegroundColor Cyan
$tsOut = npx tsc --noEmit 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "TypeScript: CLEAN" -ForegroundColor Green
} else {
    Write-Host "TypeScript ERRORS:" -ForegroundColor Red
    $tsOut | ForEach-Object { Write-Host $_ }
    exit 1
}

Write-Host ""
Write-Host "=== STEP 2: Vitest ===" -ForegroundColor Cyan
npx vitest run 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests FAILED" -ForegroundColor Red
    exit 1
}
Write-Host "Tests: PASSED" -ForegroundColor Green

Write-Host ""
Write-Host "=== STEP 3: Git Commit + Push ===" -ForegroundColor Cyan
git add -A
git status
git commit -m "feat(phase6): Logistics - Transporters, Stock Transfers, Delivery Challans with E-Way Bill support"
git push upstream main

Write-Host ""
Write-Host "=== Last 5 commits ===" -ForegroundColor Cyan
git log --oneline -5

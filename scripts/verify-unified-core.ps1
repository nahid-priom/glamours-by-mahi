# Unified core verification (Windows PowerShell)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "==> typecheck"
npm run typecheck
Write-Host "==> lint"
npm run lint
Write-Host "==> unit tests"
npm test
Write-Host "==> build"
npm run build

Write-Host "Verification complete (local DB reset/typegen optional via supabase CLI)."

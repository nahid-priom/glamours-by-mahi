$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'src\types\database.ts'
$tmp = Join-Path $env:TEMP "supabase-types-$(Get-Random).ts"

Push-Location $root
try {
  # CLI 3.x: --remote (linked project), stdout redirect (no -o path)
  cmd /c "npx supabase gen types --lang=typescript --remote 1> `"$tmp`""
  if (-not (Test-Path $tmp) -or (Get-Item $tmp).Length -lt 1000) {
    throw 'supabase gen types produced no output'
  }
  Move-Item -Force $tmp $out
  Write-Host "Wrote $out"
} finally {
  Pop-Location
  if (Test-Path $tmp) { Remove-Item -Force $tmp }
}

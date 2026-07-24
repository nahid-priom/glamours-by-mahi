$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'src\types\database.ts'
$tmp = Join-Path $env:TEMP "supabase-types-$(Get-Random).ts"

Push-Location $root
try {
  cmd /c "npx supabase gen types typescript --project-id vahqinuminrcjpussimn 1> `"$tmp`" 2>nul"
  if (-not (Test-Path $tmp) -or (Get-Item $tmp).Length -lt 1000) {
    throw 'supabase gen types produced no output'
  }
  Move-Item -Force $tmp $out
  Write-Host "Wrote $out"
} finally {
  Pop-Location
  if (Test-Path $tmp) { Remove-Item -Force $tmp }
}

# SlipUp — Bump asset versions and service worker cache for deploys.
# Equivalente a node bump-version.js (por si Node no está instalado o no está en el PATH).
#
# Uso: .\bump-version.ps1 [newVersion]
#   newVersion = número a poner (ej. 42). Si se omite, sube actual + 1.
#   Ejemplo: .\bump-version.ps1 110

$ErrorActionPreference = 'Stop'
$ROOT = $PSScriptRoot
$HTML_FILES = @('index.html', 'inside.html', 'landing.html', 'landing-inside.html', 'auth-inside.html', 'privacy.html', 'terms.html', 'refund.html')
$SW_FILE = 'sw.js'

function Get-CurrentVersion($content) {
  if ($content -match '\?v=(\d+)') { return [int]$Matches[1] }
  return $null
}

function Get-CurrentSwVersion($content) {
  if ($content -match 'slip-track-v(\d+)') { return [int]$Matches[1] }
  return 1
}

function Bump-Html($htmlPath, $newV) {
  $content = Get-Content -LiteralPath $htmlPath -Raw -Encoding UTF8
  $content = $content -replace '\?v=\d+', "?v=$newV"
  Set-Content -LiteralPath $htmlPath -Value $content -NoNewline -Encoding UTF8
  Write-Host ' ' (Split-Path -Leaf $htmlPath)
}

function Bump-Sw($swPath, $oldV, $newV) {
  $content = Get-Content -LiteralPath $swPath -Raw -Encoding UTF8
  $content = $content -replace "slip-track-v$oldV", "slip-track-v$newV"
  $content = $content -replace '\./styles\.css(\?v=\d+)?', "./styles.css?v=$newV"
  $content = $content -replace '\./entryInsightsData\.js(\?v=\d+)?', "./entryInsightsData.js?v=$newV"
  $content = $content -replace '\./app\.js(\?v=\d+)?', "./app.js?v=$newV"
  Set-Content -LiteralPath $swPath -Value $content -NoNewline -Encoding UTF8
  Write-Host ' ' (Split-Path -Leaf $swPath)
}

# Parse argument
$newVersion = $null
if ($args.Count -ge 1) {
  $parsed = 0
  if ([int]::TryParse($args[0], [ref]$parsed) -and $parsed -ge 1) { $newVersion = $parsed }
  else {
    Write-Error 'Usage: .\bump-version.ps1 [newVersion]  (newVersion must be a positive number)'
    exit 1
  }
}

# Current version from HTML
$currentVersion = $null
foreach ($name in $HTML_FILES) {
  $p = Join-Path $ROOT $name
  if (Test-Path $p) {
    $v = Get-CurrentVersion (Get-Content -LiteralPath $p -Raw -Encoding UTF8)
    if ($null -ne $v) { $currentVersion = if ($null -eq $currentVersion) { $v } else { [Math]::Max($currentVersion, $v) } }
  }
}

$targetVersion = if ($null -ne $newVersion) { $newVersion } else { if ($null -ne $currentVersion) { $currentVersion + 1 } else { 1 } }
$swPath = Join-Path $ROOT $SW_FILE
$currentSwV = Get-CurrentSwVersion (Get-Content -LiteralPath $swPath -Raw -Encoding UTF8)
$targetSwV = if ($null -ne $newVersion) { $newVersion } else { $currentSwV + 1 }

Write-Host "Bumping asset version: $(if ($null -eq $currentVersion) { 0 } else { $currentVersion }) → $targetVersion"
Write-Host "Bumping SW cache: slip-track-v$currentSwV → slip-track-v$targetSwV"
Write-Host ''

Write-Host 'HTML files:'
foreach ($name in $HTML_FILES) {
  $p = Join-Path $ROOT $name
  if (Test-Path $p) { Bump-Html $p $targetVersion }
}

Write-Host 'Service worker:'
Bump-Sw $swPath $currentSwV $targetSwV

Write-Host ''
Write-Host 'Done. Commit and push to deploy.'

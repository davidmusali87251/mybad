# Añade Node.js al PATH de esta sesión (por si no lo reconoce la terminal).
# Uso: ejecuta UNA VEZ al abrir la terminal, luego ya puedes usar node y npm:
#   . .\use-node.ps1
#   node --version
#   npm run serve

$nodeDir = "C:\Program Files\nodejs"
if (Test-Path "$nodeDir\node.exe") {
  if ($env:Path -notlike "*$nodeDir*") {
    $env:Path = "$nodeDir;" + $env:Path
    Write-Host "Node añadido al PATH de esta sesión. Puedes usar: node, npm, npx" -ForegroundColor Green
  }
  Write-Host "Node: $( & "$nodeDir\node.exe" --version )  npm: $( & "$nodeDir\npm.cmd" --version )"
} else {
  Write-Warning "No se encontró Node en $nodeDir"
}

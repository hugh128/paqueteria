# Despliega el proyecto de Windows a la VM1.
# Uso (desde la raíz del proyecto):
#   powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1
param(
  [string]$VmHost = "admin-a@192.168.56.10",
  [string]$RemoteDir = "paqueteria"   # relativo al home del usuario en la VM
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "1/4 Compilando el frontend..." -ForegroundColor Cyan
npm --prefix client install
npm --prefix client run build
if ($LASTEXITCODE -ne 0) { throw "Falló la compilación del frontend" }

Write-Host "2/4 Empaquetando (sin node_modules ni .env)..." -ForegroundColor Cyan
tar -czf release.tgz --exclude=node_modules --exclude=.env server client/dist deploy
if ($LASTEXITCODE -ne 0) { throw "Falló el empaquetado" }

Write-Host "3/4 Copiando a la VM..." -ForegroundColor Cyan
scp release.tgz "${VmHost}:/tmp/release.tgz"
if ($LASTEXITCODE -ne 0) { throw "Falló scp" }

Write-Host "4/4 Instalando y reiniciando en la VM..." -ForegroundColor Cyan
$remoto = "mkdir -p $RemoteDir && tar -xzf /tmp/release.tgz -C $RemoteDir && cd $RemoteDir/server && npm ci --omit=dev && " +
          "if systemctl list-unit-files | grep -q '^paqueteria.service'; then sudo systemctl restart paqueteria && echo 'Servicio reiniciado'; " +
          "else echo 'Servicio paqueteria aun no instalado (ver README)'; fi"
ssh -t $VmHost $remoto

Remove-Item release.tgz -ErrorAction SilentlyContinue
Write-Host "Listo." -ForegroundColor Green

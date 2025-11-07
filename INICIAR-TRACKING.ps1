# Script PowerShell para iniciar o sistema de tracking
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Iniciando Sistema de Tracking Noetika" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Muda para o diretório do script
Set-Location $PSScriptRoot

Write-Host "[1/2] Iniciando backend Python (porta 5000)..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "cd /d `"$PSScriptRoot`" && python backend.py" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "[2/2] Iniciando servidor Node.js (porta 8000)..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "cd /d `"$PSScriptRoot`" && node server.js" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Servidores iniciados!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host " Backend Python: http://localhost:5000" -ForegroundColor Cyan
Write-Host " Dashboard:      http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host " Os dados de tracking serão salvos em:" -ForegroundColor White
Write-Host " tracking_data\sessions.csv" -ForegroundColor Gray
Write-Host " tracking_data\events.csv" -ForegroundColor Gray
Write-Host ""
Write-Host " IMPORTANTE: Mantenha as janelas abertas!" -ForegroundColor Yellow
Write-Host " Para parar, feche as janelas ou pressione Ctrl+C" -ForegroundColor Yellow
Write-Host ""


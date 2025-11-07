@echo off
chcp 65001 >nul
echo ========================================
echo  Iniciando Sistema de Tracking Noetika
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Iniciando backend Python (porta 5000)...
start cmd /k "cd /d %~dp0 && python backend.py"
timeout /t 3 /nobreak >nul

echo [2/2] Iniciando servidor Node.js (porta 8000)...
start cmd /k "cd /d %~dp0 && node server.js"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo  Servidores iniciados!
echo ========================================
echo.
echo  Backend Python: http://localhost:5000
echo  Dashboard:      http://localhost:8000
echo.
echo  Os dados de tracking serao salvos em:
echo  tracking_data\sessions.csv
echo  tracking_data\events.csv
echo.
echo  IMPORTANTE: Mantenha as janelas abertas!
echo  Para parar, feche as janelas ou pressione Ctrl+C
echo.
echo  Pressione qualquer tecla para sair deste script...
pause >nul


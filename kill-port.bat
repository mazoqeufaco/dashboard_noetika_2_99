@echo off
REM Script para matar processos usando a porta 8000
echo Procurando processos na porta 8000...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    echo Processo encontrado: PID %%a
    taskkill /F /PID %%a >nul 2>&1
    if errorlevel 1 (
        echo Erro ao finalizar PID %%a
    ) else (
        echo ✅ PID %%a finalizado
    )
)

echo.
echo Concluído!
pause

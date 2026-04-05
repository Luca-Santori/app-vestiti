@echo off
title ChromaMe - Try-On AI Server
cd /d "%~dp0"

echo.
echo  ===================================================
echo   ChromaMe - Virtual Try-On AI Server
echo   http://localhost:3000
echo  ===================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERRORE: Node.js non trovato.
    echo  Scaricalo da: https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000"') do taskkill /PID %%a /F >nul 2>&1
timeout /t 1 /nobreak >nul

if not exist "node_modules" (
    echo  Installazione dipendenze...
    call npm install
)

echo  Server avviato! Apri: http://localhost:3000/index.html
echo  Tieni aperta questa finestra. Ctrl+C per fermare.
echo.

node server.js

echo.
echo  Server fermato.
pause

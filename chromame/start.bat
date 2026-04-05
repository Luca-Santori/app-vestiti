@echo off
title ChromaMe — Virtual Try-On AI Server
chcp 65001 >nul
color 0A

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       ChromaMe — Try-On AI Server       ║
echo  ║   Gratuito via HuggingFace IDM-VTON     ║
echo  ╚══════════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM Controlla se Node.js è installato
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERRORE] Node.js non trovato!
    echo  Scaricalo da: https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM Installa dipendenze se mancano
if not exist "node_modules" (
    echo  Installazione dipendenze npm...
    echo.
    npm install
    echo.
)

echo  Avvio server su http://localhost:3000
echo  Apri http://localhost:3000/index.html nel browser.
echo  Lascia questa finestra aperta mentre usi l'app.
echo  Premi Ctrl+C per fermare.
echo.

node server.js
pause

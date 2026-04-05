@echo off
title ChromaMe — Virtual Try-On AI Server
chcp 65001 >nul
color 0A

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       ChromaMe — Try-On AI Server       ║
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

REM Controlla .env
if not exist ".env" (
    echo  [ATTENZIONE] File .env non trovato!
    echo.
    echo  Crea un file ".env" nella cartella chromame con:
    echo  REPLICATE_API_TOKEN=r8_il_tuo_token_qui
    echo.
    echo  Ottieni il token GRATIS su: https://replicate.com/account/api-tokens
    echo.
    pause
    exit /b 1
)

echo  Avvio server su http://localhost:3000
echo  Lascia questa finestra aperta mentre usi l'app.
echo  Premi Ctrl+C per fermare.
echo.

node server.js
pause

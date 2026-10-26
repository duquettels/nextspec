@echo off
:: Force script directory as working directory when Run as Admin
cd /d "%~dp0"

echo Cleaning up stale background processes...
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul

echo Starting NextSpec Backend & Frontend...
start "NextSpec Backend" cmd /k "cd /d "%~dp0backend" && .\venv\Scripts\activate && uvicorn main:app --port 8080"
start "NextSpec Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
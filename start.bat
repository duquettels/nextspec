@echo off
echo Cleaning up stale processes...
taskkill /F /IM main.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul

echo Starting NextSpec Backend & Frontend...
start "NextSpec Backend" cmd /k "cd backend && .\venv\Scripts\activate && uvicorn main:app --port 8080"
start "NextSpec Frontend" cmd /k "cd frontend && npm run dev"
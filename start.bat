@echo off
:: Force script directory as working directory when Run as Admin
cd /d "%~dp0"

echo Cleaning up stale background processes...
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul

echo Ensuring Ollama is running and preloading llama3.2:3b...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="1" (
    start "" /min ollama serve
    timeout /t 3 /nobreak >nul
)
curl -s http://localhost:11434/api/generate -d "{\"model\":\"llama3.2:3b\",\"prompt\":\"ready\",\"stream\":false,\"keep_alive\":\"2h\"}" >nul 2>&1

echo Starting NextSpec Backend & Frontend...
start "NextSpec Backend" cmd /k "cd backend && .\venv\Scripts\activate && uvicorn main:app --port 8080"
start "NextSpec Frontend" cmd /k "cd frontend && npm run dev"

echo Launching NextSpec borderless app window...
timeout /t 3 /nobreak >nul
start "" chrome --app=http://localhost:5173
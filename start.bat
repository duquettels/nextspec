@echo off
echo Initializing NextSpec...

:: Start FastAPI Backend
:: Adjust the folder name (e.g., 'backend') and virtual environment activation if needed
start "NextSpec Backend" cmd /k "cd backend && uvicorn main_2:app --port 8000 --reload"

:: Start React Frontend
:: Adjust the folder name (e.g., 'frontend') if needed
start "NextSpec Frontend" cmd /k "cd frontend && npm run dev"

echo Servers are booting up.
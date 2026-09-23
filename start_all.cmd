@echo off
rem Arranca backend + frontend da app EAC em duas janelas
start "EAC backend (8000)" cmd /k "cd /d c:\Users\fl1pe\Desktop\EAC\projeto-rag && venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
timeout /t 3 >nul
start "EAC frontend (5173)" cmd /k "cd /d c:\Users\fl1pe\Desktop\EAC\evora-andebol-app && npm run dev"
echo.
echo Backend:  http://127.0.0.1:8000  (docs em /docs)
echo Frontend: http://localhost:5173

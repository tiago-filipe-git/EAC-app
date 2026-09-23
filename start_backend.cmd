@echo off
rem Arranca o backend da app EAC (FastAPI/uvicorn na porta 8000)
cd /d "c:\Users\fl1pe\Desktop\EAC\projeto-rag"
echo A arrancar backend em http://127.0.0.1:8000 ...
".\venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause

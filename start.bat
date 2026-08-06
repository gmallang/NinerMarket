@echo off
setlocal
echo =======================================
echo   NinerMarket - Starting Dev Servers
echo =======================================
echo.

set "ROOT=%~dp0"
set "PYTHON=C:\Users\saife\AppData\Local\Programs\Python\Python313\python.exe"
set "VENV=%ROOT%Backend\venv"

:: ---- Backend setup ----
echo [1/3] Checking Python virtual environment...
if not exist "%VENV%\Scripts\activate.bat" (
    echo       Creating venv...
    "%PYTHON%" -m venv "%VENV%"
)

echo [2/3] Installing backend dependencies...
call "%VENV%\Scripts\activate.bat"
pip install -r "%ROOT%Backend\requirements.txt" --quiet

echo [3/3] Launching servers...
echo.

:: Start backend in new window (venv already activated)
start "NinerMarket - Backend  [http://localhost:8000]" cmd /k "call ""%VENV%\Scripts\activate.bat"" && cd /d ""%ROOT%Backend"" && uvicorn main:app --reload"

:: Brief pause then start frontend
timeout /t 2 /nobreak >nul
start "NinerMarket - Frontend [http://localhost:5173]" cmd /k "cd /d ""%ROOT%frontend"" && npm run dev"

echo Both servers are starting in separate windows:
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo.
echo You can close this window.
pause

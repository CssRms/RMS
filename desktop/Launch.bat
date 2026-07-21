@echo off
cd /d "%~dp0"

:: ── Check if already Administrator ────────────────────────────
net session >nul 2>&1
if %errorlevel% == 0 goto :run

:: ── Not admin — re-launch this file elevated (VISIBLE window) ─
set "D=%~dp0"
set "D=%D:~0,-1%"
powershell -NoProfile -Command "Start-Process cmd.exe -Verb RunAs -ArgumentList '/k cd /d %D% && call Launch.bat'"
exit /b

:: ── Already admin — start the app ─────────────────────────────
:run
title ZKTeco Attendance Monitor
cls
echo.
echo  ============================================
echo   ZKTeco Attendance Monitor  ^|  Starting...
echo  ============================================
echo   Dashboard : http://localhost
echo   Tray icon : look for green icon bottom-right
echo   To stop   : tray icon ^> Quit  (or close window)
echo  ============================================
echo.

python -c "import flask" >nul 2>&1
if %errorlevel% neq 0 (
    echo  [Setup] Installing required packages...
    python -m pip install flask flask-socketio eventlet sqlalchemy openpyxl pystray Pillow -q
    echo  [Setup] Done.
    echo.
)

python app.py

echo.
echo  ============================================
echo   App has stopped.
echo  ============================================
pause

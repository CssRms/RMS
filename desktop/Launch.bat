@echo off
:: ============================================================
::  ZKTeco Attendance Monitor — Launcher
::  Double-click this file to start.
::  It requests Administrator rights automatically.
:: ============================================================

:: If not admin, re-launch this file elevated (silent UAC prompt)
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -NoProfile -WindowStyle Hidden -Command ^
      "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: Already admin — change to this file's directory and run
cd /d "%~dp0"

:: Check Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Python is not installed or not in PATH.
    echo  Download Python 3.10+ from https://python.org
    echo  Make sure to check "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)

:: Check dependencies installed
python -c "import flask, pystray" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  Installing required packages (first-time setup)...
    python -m pip install flask flask-socketio eventlet sqlalchemy openpyxl pystray Pillow -q
    echo  Done.
    echo.
)

echo.
echo  ============================================================
echo   ZKTeco Attendance Monitor  ^|  Starting...
echo  ============================================================
echo   Dashboard will open in your browser automatically.
echo   Look for the green icon in the system tray (bottom-right).
echo   Right-click the tray icon to access Settings or Quit.
echo  ============================================================
echo.

python app.py

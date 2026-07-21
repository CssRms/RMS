@echo off
echo ============================================
echo  ZKTeco Attendance Monitor -- Build Script
echo ============================================
echo.

:: Install / update all dependencies
echo [1/3] Installing dependencies...
pip install -r requirements.txt -q
if %errorlevel% neq 0 (
    echo ERROR: pip install failed. Check your Python installation.
    pause & exit /b 1
)

:: Generate icon file
echo [2/3] Generating icon...
python -c "
from PIL import Image, ImageDraw
imgs = []
for size in [16,32,48,64,128,256]:
    img = Image.new('RGBA',(size,size),(0,0,0,0))
    d = ImageDraw.Draw(img)
    m = max(1,size//24)
    d.ellipse([m,m,size-m,size-m], fill='#1a7a3e')
    cx,cy = size//2,size//2
    for r in range(size//8,size//3,max(1,size//9)):
        d.arc([cx-r,cy-r,cx+r,cy+r],210,330,fill='white',width=max(1,size//24))
    r=max(2,size//14)
    d.ellipse([cx-r,cy-r,cx+r,cy+r],fill='white')
    imgs.append(img)
imgs[0].save('icon.ico',format='ICO',sizes=[(s,s) for s in [16,32,48,64,128,256]],append_images=imgs[1:])
print('  icon.ico created')
"

:: Package with PyInstaller
echo [3/3] Building .exe...
pyinstaller ^
  --onefile ^
  --windowed ^
  --name "ZKAttendance" ^
  --icon "icon.ico" ^
  --add-data "templates;templates" ^
  --hidden-import "engineio.async_drivers.threading" ^
  --hidden-import "flask_socketio" ^
  --hidden-import "eventlet" ^
  --hidden-import "sqlalchemy" ^
  --hidden-import "openpyxl" ^
  --hidden-import "pystray" ^
  --hidden-import "PIL" ^
  --clean ^
  app.py

if %errorlevel% neq 0 (
    echo.
    echo ERROR: PyInstaller build failed. See output above.
    pause & exit /b 1
)

echo.
echo ============================================
echo  BUILD COMPLETE
echo ============================================
echo  Output: dist\ZKAttendance.exe
echo.
echo  To distribute:
echo    Copy dist\ZKAttendance.exe to any Windows PC.
echo    No Python installation needed to run it.
echo.
echo  First run on a new PC:
echo    Double-click ZKAttendance.exe
echo    Right-click tray icon ^> Settings to set Railway URL
echo    Right-click tray icon ^> Start with Windows to auto-start
echo ============================================
pause

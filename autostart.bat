@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Автозапуск Safar при входе в Windows: ярлык на start.bat в папке «Автозагрузка» (окно свёрнуто).
rem Отключить: запустите  autostart.bat off  или удалите ярлык «Safar» в папке shell:startup
set "LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Safar.lnk"
if /i "%~1"=="off" (
  del "%LINK%" 2>nul
  echo Автозапуск Safar выключен.
  pause
  exit /b
)
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:LINK); $s.TargetPath='%~dp0start.bat'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Description='Safar: сервер и туннель'; $s.Save()"
echo Готово: Safar будет запускаться сам при входе в Windows.
echo Выключить: autostart.bat off
pause

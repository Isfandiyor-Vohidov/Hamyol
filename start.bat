@echo off
chcp 65001 >nul
title Safar — сервер и туннель
cd /d "%~dp0"
rem Запускает ngrok и сервер Safar, перезапускает их при падении (scripts\run.mjs)
node scripts\run.mjs
pause

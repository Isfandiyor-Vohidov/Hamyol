@echo off
chcp 65001 >nul
title Hamyol — сервер и туннель Cloudflare
cd /d "%~dp0"
rem Как start.bat, но через Cloudflare Tunnel (без лимита трафика). Нужен cloudflared:  winget install --id Cloudflare.cloudflared
set TUNNEL=cloudflare
node scripts\run.mjs
pause

@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите Node.js с https://nodejs.org или откройте index.html в Chrome/Edge
  echo ^(голосовое управление может не работать при открытии файла напрямую^).
  pause
  exit /b
)
start "" http://localhost:8080
node server.js

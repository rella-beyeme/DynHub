@echo off
rem ==========================================================================
rem  HUB DYNEFF - demarrage du serveur local
rem  Fermez cette fenetre (ou Ctrl+C) pour arreter le serveur.
rem ==========================================================================
setlocal
cd /d "%~dp0"
title Hub Dyneff - serveur

where node >nul 2>nul
if errorlevel 1 (
  echo  [ERREUR] Node.js n'est pas installe. Lancez d'abord installer.bat
  pause
  exit /b 1
)

if not exist "node_modules\express\package.json" (
  call "%~dp0installer.bat" /silencieux
  if errorlevel 1 exit /b 1
)

node scripts\preparer-config.js
if errorlevel 1 (
  pause
  exit /b 1
)

set "URL_HUB=http://localhost:3000"
for /f "tokens=1,* delims==" %%a in ('findstr /b /c:"URL_PUBLIQUE=" .env') do set "URL_HUB=%%b"

echo.
echo  Le hub demarre sur %URL_HUB%
echo  Le navigateur va s'ouvrir. Fermez cette fenetre pour arreter le serveur.
echo.
start "" /b cmd /c "ping -n 4 127.0.0.1 >nul && start %URL_HUB%"
node serveur.js

echo.
echo  Le serveur s'est arrete.
pause

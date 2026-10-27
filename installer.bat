@echo off
rem ==========================================================================
rem  HUB DYNEFF - installation (a lancer une fois, puis apres chaque mise a jour)
rem ==========================================================================
setlocal
cd /d "%~dp0"
title Hub Dyneff - installation
echo.
echo  === Hub Dyneff : installation ===
echo.

where node >nul 2>nul
if errorlevel 1 goto pas_de_node

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJ=%%v
if %NODE_MAJ% LSS 20 goto node_ancien
echo  Node.js detecte :
node --version
echo.

echo  Telechargement des dependances...
call npm ci --omit=dev --no-audit --no-fund
if errorlevel 1 goto echec_npm
rem Empreinte des dependances : demarrer.bat reinstalle si elles changent (git pull)
copy /y package-lock.json node_modules\.hub-dependances >nul

node scripts\preparer-config.js
if errorlevel 1 goto echec

echo.
echo  Installation terminee. Lancez maintenant demarrer.bat
echo.
if /i not "%~1"=="/silencieux" pause
exit /b 0

:pas_de_node
echo  [ERREUR] Node.js n'est pas installe sur cette machine.
echo  Installez la version LTS depuis https://nodejs.org puis relancez ce script.
goto echec

:node_ancien
echo  [ERREUR] Node.js version 20 ou plus recente est necessaire.
echo  Installez la version LTS depuis https://nodejs.org puis relancez ce script.
goto echec

:echec_npm
echo.
echo  [ERREUR] Impossible de telecharger les dependances depuis registry.npmjs.org.
echo  Si la VM passe par un proxy, configurez-le puis relancez ce script :
echo     npm config set proxy http://ADRESSE_PROXY:PORT
echo     npm config set https-proxy http://ADRESSE_PROXY:PORT
goto echec

:echec
echo.
pause
exit /b 1

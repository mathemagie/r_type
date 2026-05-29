@echo off
title R-TYPELIKE - Neon Drift
echo ============================================
echo   R-TYPELIKE - Demarrage en cours...
echo ============================================
echo.

REM Test si Python est dispo
where python >nul 2>nul
if %errorlevel%==0 goto :runserver
where py >nul 2>nul
if %errorlevel%==0 goto :runserver_py

REM Pas de Python : tente une ouverture directe (marche dans Firefox)
echo Python n'est pas installe.
echo Tentative d'ouverture directe dans le navigateur par defaut...
echo (Si rien ne s'affiche, essayer avec Firefox, ou installer Python)
start "" "%~dp0index.html"
pause
exit /b

:runserver
echo Serveur local demarre sur http://localhost:8765
echo Ouverture du navigateur...
start "" "http://localhost:8765"
cd /d "%~dp0"
python -m http.server 8765
exit /b

:runserver_py
echo Serveur local demarre sur http://localhost:8765
echo Ouverture du navigateur...
start "" "http://localhost:8765"
cd /d "%~dp0"
py -m http.server 8765
exit /b

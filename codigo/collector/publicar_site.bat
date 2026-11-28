@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Jungle Performance Analytics - atualizar o site
where python >nul 2>nul
if %errorlevel%==0 (
  python coletor_riot.py --publicar %*
) else (
  py coletor_riot.py --publicar %*
)
echo.
echo Pressione qualquer tecla para fechar.
pause >nul

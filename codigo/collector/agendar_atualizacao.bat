@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Jungle Performance Analytics - agendar atualizacao
where python >nul 2>nul
if %errorlevel%==0 (
  python coletor_riot.py --agendar %*
) else (
  py coletor_riot.py --agendar %*
)
echo.
echo Pressione qualquer tecla para fechar.
pause >nul

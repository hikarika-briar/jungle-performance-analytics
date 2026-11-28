@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Jungle Performance Analytics - atualizar tudo
where python >nul 2>nul
if %errorlevel%==0 (
  python coletor_riot.py --tudo %*
) else (
  py coletor_riot.py --tudo %*
)
echo.
echo Pronto. Com o token do site configurado, o site ja foi atualizado.
echo Para o painel do Claude, importe os dois arquivos da pasta saida.
echo Pressione qualquer tecla para fechar.
pause >nul

@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  python coletor_riot.py --cancelar-agendamento
) else (
  py coletor_riot.py --cancelar-agendamento
)
echo.
echo Pressione qualquer tecla para fechar.
pause >nul

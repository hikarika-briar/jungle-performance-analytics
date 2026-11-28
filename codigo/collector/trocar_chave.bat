@echo off
cd /d "%~dp0"
if not exist chave_api.txt echo Apague esta linha, cole aqui a chave RGAPI-... e salve com Ctrl+S.>chave_api.txt
start "" notepad.exe "chave_api.txt"

@echo off
cd /d "%~dp0"
if not exist github_token.txt echo Apague esta linha, cole aqui o token do GitHub github_pat_... e salve com Ctrl+S.>github_token.txt
start "" notepad.exe "github_token.txt"

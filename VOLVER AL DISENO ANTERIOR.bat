@echo off
echo Se restaurara el aspecto anterior del casino.
echo El diseno actual se guardara primero. Tu saldo no se modifica.
pause
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\restaurar-diseno.ps1"
pause

@echo off
REM ============================================================
REM  BUBBA GAMES - abrir el casino
REM
REM  Doble clic aca y listo: levanta el servidor y abre el
REM  navegador. Para cerrar, cerra esta ventana negra.
REM
REM  Hace falta un servidor (y no alcanza con abrir index.html)
REM  porque Maverick y Se Busca van en un iframe y comparten la
REM  billetera por postMessage: eso necesita un origen http real.
REM ============================================================
title Bubba Games - servidor (no cerrar mientras jugas)
cd /d "%~dp0"

echo.
echo   BUBBA GAMES
echo   ------------------------------------------
echo   Servidor levantado en http://localhost:8123
echo.
echo   Dejala abierta mientras jugas.
echo   Para cerrar el casino, cerra esta ventana.
echo   ------------------------------------------
echo.

REM Abre el navegador un segundo despues, para darle tiempo al servidor.
start "" cmd /c "timeout /t 1 >nul & start http://localhost:8123"

REM Python es lo que ya tenes instalado. Si algun dia no esta,
REM el fallback usa Node.
python -m http.server 8123 2>nul
if errorlevel 1 (
  echo Python no respondio, probando con Node...
  npx --yes http-server -p 8123 -c-1
)

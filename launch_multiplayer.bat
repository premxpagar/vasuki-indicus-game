@echo off
cd /d "%~dp0"

echo ========================================================
echo   VASUKI INDICUS — Launching Game with Multiplayer Server
echo ========================================================
echo.

:: 1. Start the HTTP static file server
start /B powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File server.ps1 > server.log 2>&1

:: 2. Start the WebSocket multiplayer game server
start /B node server\server.js > server_mp.log 2>&1

:: Wait 2 seconds for servers to initialize
ping 127.0.0.1 -n 3 > nul

echo Game server running at: http://localhost:8000
echo Multiplayer server running at: ws://localhost:3000
echo.
echo Opening game in your browser...

:: 3. Launch browser
start http://localhost:8000

echo.
echo ========================================================
echo Press any key when you finish playing to stop servers...
echo ========================================================
pause > nul

:: Terminate background processes
wmic process where "name='powershell.exe' and commandline like '%%server.ps1%%'" call terminate > nul 2>&1
wmic process where "name='node.exe' and commandline like '%%server.js%%'" call terminate > nul 2>&1
echo Done.

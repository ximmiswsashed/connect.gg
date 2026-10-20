@echo off
setlocal
cd /d "%~dp0"
set "GAME_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "GAME_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "LOBBY_ALLOWED_ORIGINS=https://ximmiswsashed.github.io,https://mhm.tail8dfc7f.ts.net"
echo Keep this window open while friends play Breach Protocol.
"%GAME_NODE%" tools\serve-checkpoint.mjs ..\oregon 5311
pause

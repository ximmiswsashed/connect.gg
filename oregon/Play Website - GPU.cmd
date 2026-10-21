@echo off
setlocal
rem Use the same isolated D3D11 profile that fixed the local game's software rendering.
set "BP_BRAVE="
if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" set "BP_BRAVE=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined BP_BRAVE if exist "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" set "BP_BRAVE=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined BP_BRAVE if exist "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" set "BP_BRAVE=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined BP_BRAVE (
 echo Brave was not found. Install Brave or enable graphics acceleration in your current browser.
 pause
 exit /b 1
)
start "" "%BP_BRAVE%" "--user-data-dir=%LOCALAPPDATA%\BreachProtocol\GPUProfile" --use-angle=d3d11 --no-first-run --no-default-browser-check "https://ximmiswsashed.github.io/connect.gg/"
exit /b

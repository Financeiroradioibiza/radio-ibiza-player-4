@echo off
REM Reparo permissoes modo TI — executar como Administrador (raro; o instalador ja faz isto).
setlocal
net session >nul 2>&1
if errorlevel 1 (
  echo Execute como Administrador: botao direito neste ficheiro.
  pause
  exit /b 1
)
set "PS1=%~dp0setup-programdata-acl.ps1"
if not exist "%PS1%" set "PS1=%~dp0resources\setup-programdata-acl.ps1"
if not exist "%PS1%" (
  echo Nao encontrou setup-programdata-acl.ps1
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
echo.
echo Concluido. Teste com utilizador NORMAL — atalho Radio Ibiza.exe
pause

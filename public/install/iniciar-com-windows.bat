@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "DEST=%STARTUP%\Radio Ibiza.lnk"
set "FOUND="

if not exist "%STARTUP%\" (
  call :MsgBox "Nao encontrei a pasta Inicializar neste Windows."
  exit /b 1
)

call :TryLnk "%USERPROFILE%\Desktop\Player Radio Ibiza.lnk"
call :TryLnk "%USERPROFILE%\Desktop\Radio Ibiza Player.lnk"
call :TryLnk "%USERPROFILE%\Desktop\Radio Ibiza.lnk"
call :TryLnk "%PUBLIC%\Desktop\Player Radio Ibiza.lnk"
call :TryLnk "%PUBLIC%\Desktop\Radio Ibiza Player.lnk"
call :TryLnk "%PUBLIC%\Desktop\Radio Ibiza.lnk"
call :TryLnk "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Player Radio Ibiza.lnk"
call :TryLnk "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Radio Ibiza Player.lnk"
call :TryLnk "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Radio Ibiza.lnk"

if not defined FOUND if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Chrome Apps\" (
  for /f "delims=" %%F in ('dir /b /s "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Chrome Apps\*.lnk" 2^>nul') do (
    echo %%~nxF | findstr /i /c:"Radio" /c:"Ibiza" /c:"Player" >nul
    if not errorlevel 1 if not defined FOUND set "FOUND=%%F"
  )
)

if not defined FOUND if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Microsoft\Edge\Apps\" (
  for /f "delims=" %%F in ('dir /b /s "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Microsoft\Edge\Apps\*.lnk" 2^>nul') do (
    echo %%~nxF | findstr /i /c:"Radio" /c:"Ibiza" /c:"Player" >nul
    if not errorlevel 1 if not defined FOUND set "FOUND=%%F"
  )
)

if not defined FOUND (
  call :MsgBox "Nao achei o atalho do Radio Ibiza. Instale o app pelo Chrome antes de ativar."
  exit /b 1
)

copy /Y "%FOUND%" "%DEST%" >nul 2>&1
if errorlevel 1 (
  call :MsgBox "Erro ao copiar o atalho. Tente como administrador ou arraste manualmente para Inicializar."
  exit /b 1
)

call :MsgBox "Pronto! O Radio Ibiza vai abrir sozinho quando voce entrar no Windows."
exit /b 0

:TryLnk
if defined FOUND goto :eof
if exist "%~1" set "FOUND=%~1"
goto :eof

:MsgBox
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.MessageBox]::Show('%~1','Radio Ibiza',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)"
goto :eof

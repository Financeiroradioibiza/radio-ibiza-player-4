@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

title Radio Ibiza — Iniciar com o Windows

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "DEST=%STARTUP%\Radio Ibiza.lnk"
set "FOUND="

echo.
echo  Radio Ibiza Player
echo  Configurar abertura ao iniciar o Windows
echo.

if not exist "%STARTUP%\" (
  echo  Erro: pasta Inicializar nao encontrada.
  echo.
  pause
  exit /b 1
)

call :TryLnk "%USERPROFILE%\Desktop\Radio Ibiza Player.lnk"
call :TryLnk "%USERPROFILE%\Desktop\Radio Ibiza.lnk"
call :TryLnk "%USERPROFILE%\Desktop\Player Radio Ibiza.lnk"
call :TryLnk "%PUBLIC%\Desktop\Radio Ibiza Player.lnk"
call :TryLnk "%PUBLIC%\Desktop\Radio Ibiza.lnk"
call :TryLnk "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Radio Ibiza Player.lnk"
call :TryLnk "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Radio Ibiza.lnk"

if not defined FOUND if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Chrome Apps\" (
  for /f "delims=" %%F in ('dir /b /s "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Chrome Apps\*.lnk" 2^>nul') do (
    echo %%~nxF | findstr /i /c:"Radio" /c:"Ibiza" >nul
    if not errorlevel 1 if not defined FOUND set "FOUND=%%F"
  )
)

if not defined FOUND if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Microsoft\Edge\Apps\" (
  for /f "delims=" %%F in ('dir /b /s "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Microsoft\Edge\Apps\*.lnk" 2^>nul') do (
    echo %%~nxF | findstr /i /c:"Radio" /c:"Ibiza" >nul
    if not errorlevel 1 if not defined FOUND set "FOUND=%%F"
  )
)

if not defined FOUND (
  echo  Nao encontrei o atalho do Radio Ibiza neste computador.
  echo.
  echo  Faca isto antes:
  echo   1. Instale o aplicativo em https://player4.radioibiza.com.br/instalar.html
  echo   2. Confirme que existe um icone na Area de trabalho
  echo   3. Execute este ficheiro de novo
  echo.
  echo  Ou manualmente: Win+R, shell:startup, arraste o atalho para la.
  echo.
  pause
  exit /b 1
)

copy /Y "%FOUND%" "%DEST%" >nul 2>&1
if errorlevel 1 (
  echo  Erro ao copiar o atalho para Inicializar.
  echo  Tente manualmente: Win+R ^> shell:startup ^> arraste o atalho.
  echo.
  pause
  exit /b 1
)

echo  Pronto! Atalho copiado para a pasta Inicializar.
echo.
echo  Origem: %FOUND%
echo  Destino: %DEST%
echo.
echo  Ao ligar ou reiniciar o Windows, o player deve abrir sozinho
echo  depois que voce entrar no usuario do Windows.
echo.
pause
exit /b 0

:TryLnk
if defined FOUND goto :eof
if exist "%~1" set "FOUND=%~1"
goto :eof

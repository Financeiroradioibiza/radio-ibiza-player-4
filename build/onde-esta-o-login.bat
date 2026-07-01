@echo off
REM Onde o Radio Ibiza pode ter gravado o login — executar no PC cliente
setlocal EnableExtensions

echo.
echo === Radio Ibiza — onde esta o login? ===
echo.

set "PD=%ProgramData%\RadioIbizaPlayer"
set "PD_SESSAO=%PD%\sessao.json"

echo [1] CORRETO (.exe modo TI) — ProgramData:
if exist "%PD_SESSAO%" (
  echo     ENCONTRADO: %PD_SESSAO%
  powershell -NoProfile -Command "try { $j=Get-Content -Raw '%PD_SESSAO%' | ConvertFrom-Json; if ($j.token.token) { '     token=SIM' } else { '     token=NAO (ficheiro vazio — faca login)' } } catch { '     ERRO JSON' }"
) else (
  echo     NAO EXISTE: %PD_SESSAO%
)
if exist "%PD%\onde-estao-os-dados.txt" (
  echo     Ver tambem: %PD%\onde-estao-os-dados.txt
)
echo.

echo [2] Perfil Electron deste utilizador ^(login ERRADO aqui se ProgramData vazio^):
set "APPDATA_RB=%APPDATA%\Radio Ibiza"
if exist "%APPDATA_RB%" (
  echo     PASTA: %APPDATA_RB%
  dir /s /b "%APPDATA_RB%\IndexedDB" 2>nul | findstr /i leveldb
  if exist "%APPDATA_RB%\onde-estao-os-dados.txt" type "%APPDATA_RB%\onde-estao-os-dados.txt"
) else (
  echo     Nao existe %APPDATA_RB%
)
echo.

echo [3] ProgramData perfil partilhado Chromium:
if exist "%PD%\chromium-profile\IndexedDB" (
  echo     IndexedDB em: %PD%\chromium-profile\IndexedDB
  echo     ^(se login esta aqui e nao em sessao.json, o .exe esta em modo PWA/antigo^)
) else (
  echo     Sem IndexedDB em ProgramData\chromium-profile
)
echo.

echo [4] Atalho deste utilizador:
set "LNK=%USERPROFILE%\Desktop\Radio Ibiza.lnk"
if exist "%LNK%" (
  for /f "delims=" %%A in ('powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%').TargetPath"') do echo     Destino: %%A
) else (
  echo     Sem atalho no desktop — Menu Iniciar ^> Radio Ibiza
)
echo.

echo === Resumo ===
echo Login partilhado = sessao.json em ProgramData com token.
echo Se so existir IndexedDB em AppData, NAO e modo TI correcto.
echo Abra Radio Ibiza.exe, F12, procure linha [storage] Modo TI
echo.
pause

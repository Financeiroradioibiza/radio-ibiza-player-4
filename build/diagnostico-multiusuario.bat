@echo off
REM Diagnostico modo TI multiusuario — executar como Administrador
setlocal EnableExtensions
set "ROOT=%ProgramData%\RadioIbizaPlayer"

echo.
echo === Radio Ibiza — diagnostico multiusuario ===
echo.

net session >nul 2>&1
if errorlevel 1 echo [AVISO] Nao esta em modo Admin — alguns testes podem falhar.
echo.

echo [1] Pasta de dados:
if exist "%ROOT%" (
  echo     OK: %ROOT%
  dir "%ROOT%" /b
) else (
  echo     FALTA: pasta nao existe — faca login no .exe primeiro
)
echo.

echo [2] Sessao gravada:
if exist "%ROOT%\sessao.json" (
  echo     OK: sessao.json existe
) else (
  echo     FALTA: sessao.json — alguem precisa fazer login no Radio Ibiza.exe
)
echo.

echo [3] Atalho no Ambiente de trabalho deste usuario:
if exist "%USERPROFILE%\Desktop\Radio Ibiza.lnk" (
  echo     Encontrado. Destino:
  powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\Radio Ibiza.lnk'); $s.TargetPath"
) else (
  echo     Nao ha atalho no desktop deste usuario — use Menu Iniciar ^> Radio Ibiza
)
echo.

echo [4] Permissoes (icacls):
if exist "%ROOT%" icacls "%ROOT%"
echo.

echo === Fim ===
echo O atalho DEVE apontar para Radio Ibiza.exe (nao Chrome/Edge com player4).
echo.
pause

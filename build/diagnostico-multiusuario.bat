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
) else (
  echo     FALTA: pasta nao existe — instale o .exe como admin ou abra Radio Ibiza.exe uma vez
)
echo.

echo [1b] Ficheiros obrigatorios (criados pelo instalador / 1o arranque):
for %%F in (sessao.json configs.json machine_device_id.txt) do (
  if exist "%ROOT%\%%F" (echo     OK: %%F) else (echo     FALTA: %%F)
)
echo.

echo [2] Sessao gravada (modo TI usa este ficheiro, NAO IndexedDB por utilizador):
if exist "%ROOT%\ui-build-target.txt" (
  echo     UI empacotada:
  type "%ROOT%\ui-build-target.txt"
)
if exist "%ROOT%\sessao.json" (
  echo     OK: sessao.json existe
  powershell -NoProfile -Command "try { $j=Get-Content -Raw '%ROOT%\sessao.json' | ConvertFrom-Json; if ($j.token.token) { '     token=SIM' } else { '     token=NAO (fazer login)' } } catch { '     ERRO ao ler JSON' }"
) else (
  echo     FALTA: sessao.json — faca login no Radio Ibiza.exe com utilizador normal
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

echo [5] Ultimos arranques (cada utilizador Windows):
if exist "%ROOT%\ultimo-arranque.txt" type "%ROOT%\ultimo-arranque.txt"
echo.

echo [6] Erros de storage (permissoes / leitura):
if exist "%ROOT%\storage-erro.txt" (
  echo     --- storage-erro.txt ---
  type "%ROOT%\storage-erro.txt"
) else (
  echo     Nenhum erro registado.
)
echo.

echo [7] Auditoria de gravacao (login deve mostrar token=sim):
if exist "%ROOT%\storage-audit.log" (
  powershell -NoProfile -Command "Get-Content -Tail 8 '%ROOT%\storage-audit.log'"
) else (
  echo     Sem storage-audit.log
)
echo.

echo === Fim ===
echo O atalho DEVE apontar para Radio Ibiza.exe (nao Chrome/Edge com player4).
echo.
pause

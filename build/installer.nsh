; Hook NSIS para o instalador do Radio Ibiza Player (Windows).
;
; Garante que `C:\ProgramData\RadioIbizaPlayer\` exista com permissão de escrita
; para qualquer usuário Windows logado — requisito do modo multi-usuário (ver
; DEC-009 em DECISIONS.md). Sem isso, só o primeiro usuário a abrir o player
; consegue gravar `sessao.json`, `pending-executions\` e `audio\`.
;
; O diretório é preservado no uninstall (dados do PDV: histórico, cache).
; Para apagar tudo, o operador pode rodar `rmdir /s C:\ProgramData\RadioIbizaPlayer`
; manualmente após desinstalar.
;
; Inicialização do Windows: com `perMachine`, `SetShellVarContext all` faz `$SMSTARTUP`
; apontar para a pasta «Inicialização» comum (`ProgramData\...\StartUp`) — o player
; abre ao ligar a sessão (PDV deve tocar sem login manual).
;
; Atalhos na pasta de instalação (`$INSTDIR`, ex.: C:\Program Files\Radio Ibiza\):
; o electron-builder já copia o `.exe` e o desinstalador para lá, mas o Explorador
; fica mais claro com `.lnk` «Radio Ibiza» e «Desinstalar Radio Ibiza» ao lado.
; `${APP_EXECUTABLE_FILENAME}` e `${UNINSTALL_FILENAME}` vêm de `common.nsh` do
; electron-builder (ex.: `Radio Ibiza.exe`, `Uninstall Radio Ibiza.exe`).
;
; Desinstalação (`un.radioIbizaStopAndRemoveStartup`): encerra o processo para parar
; o áudio, apaga atalhos órfãos em Startup / Ambiente de trabalho e remove entradas
; típicas em HKCU/HKLM Run — evita o app voltar a abrir «tocando» na próxima sessão.
; O modelo Jump List / barra de tarefas é tratado pelo próprio template (AppUserModelId).

!ifdef BUILD_UNINSTALLER
Function un.radioIbizaStopAndRemoveStartup
  ; Encerrar o player e subprocessos (/T). Ignora código de saída se já não existir.
  ; No desinstalador `${APP_EXECUTABLE_FILENAME}` não está disponível no parse — usar o nome do .exe do produto.
  ClearErrors
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM "${PRODUCT_FILENAME}.exe" /T' $R9
  ClearErrors

  ; «Iniciar com o Windows» via pasta Startup (perfil atual e todos os usuários).
  SetShellVarContext current
  Delete "$SMSTARTUP\Radio Ibiza.lnk"
  Delete "$SMSTARTUP\Desinstalar Radio Ibiza.lnk"
  Delete "$SMSTARTUP\Player Radio Ibiza.lnk"
  SetShellVarContext all
  Delete "$SMSTARTUP\Radio Ibiza.lnk"
  Delete "$SMSTARTUP\Desinstalar Radio Ibiza.lnk"
  Delete "$SMSTARTUP\Player Radio Ibiza.lnk"
  SetShellVarContext current

  ; Atalhos com o mesmo nome no Ambiente de trabalho (por usuário e área de trabalho pública).
  SetShellVarContext current
  Delete "$DESKTOP\Radio Ibiza.lnk"
  Delete "$DESKTOP\Desinstalar Radio Ibiza.lnk"
  SetShellVarContext all
  Delete "$DESKTOP\Radio Ibiza.lnk"
  Delete "$DESKTOP\Desinstalar Radio Ibiza.lnk"
  SetShellVarContext current

  ; Registro Run — combinações usadas por «abrir ao iniciar» ou cópias manuais.
  ; A vista do registro (32/64) já foi afinada pelo desinstalador do electron-builder.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Radio Ibiza"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_FILENAME}"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "Radio Ibiza"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_FILENAME}"
FunctionEnd
!endif

; Dados partilhados + ACL (PowerShell — mesmo script que o .exe corre no arranque).
Function radioIbizaSetupMultiUserData
  ExecWait '"$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\setup-programdata-acl.ps1"' $2
FunctionEnd

!macro customInstall
  SetShellVarContext all

  Call radioIbizaSetupMultiUserData

  CreateShortCut "$INSTDIR\Radio Ibiza.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\RadioIbiza.ico" 0 "" "" "Radio Ibiza Player"
  CreateShortCut "$INSTDIR\Desinstalar Radio Ibiza.lnk" "$INSTDIR\${UNINSTALL_FILENAME}" "" "$INSTDIR\resources\RadioIbiza.ico" 0 "" "" "Desinstalar o Radio Ibiza"
  CreateShortCut "$SMPROGRAMS\Radio Ibiza\Radio Ibiza.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\RadioIbiza.ico" 0 "" "" "Radio Ibiza Player"
  CreateShortCut "$SMSTARTUP\Radio Ibiza.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\RadioIbiza.ico" 0 "" "" "Radio Ibiza Player"
  CreateShortCut "$DESKTOP\Radio Ibiza.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\RadioIbiza.ico" 0 "" "" "Radio Ibiza Player"

  CopyFiles /SILENT "$INSTDIR\resources\corrigir-permissoes-multiusuario.bat" "$INSTDIR\corrigir-permissoes-multiusuario.bat"

  SetShellVarContext current

  CreateShortCut "$DESKTOP\Radio Ibiza.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\RadioIbiza.ico" 0 "" "" "Radio Ibiza Player"
!macroend

!macro customUnInstall
  Call un.radioIbizaStopAndRemoveStartup

  ; Não apagar o diretório de dados — preserva histórico do PDV caso o usuário
  ; reinstale depois. Se o cliente quiser limpar tudo, faz manualmente.
!macroend

; Hook NSIS — instalador per-machine (electron-builder nsis.perMachine: true).
;
; TOKEN / SESSÃO: C:\ProgramData\RadioIbizaPlayer\sessao.json
;   — NÃO em Program Files, NÃO em %APPDATA% (app.getPath('userData') por utilizador).
; O .exe redirecciona o perfil Chromium para ProgramData\chromium-profile, mas o
; login do player vive só em sessao.json (IPC main process).
;
; customInstall: cria ProgramData + ACL Built-in Users (BU) FullAccess
; (SID S-1-5-32-545 — equivalente a AccessControl::GrantOnFolder "(BU)" "FullAccess";
;  o plugin AccessControl não vem no NSIS do electron-builder, usamos icacls + PS1).
;
; NOTA NSIS: não usar !define com "$COMMONAPPDATA\..." — o \R quebra a expansão
; da variável (warning 6000). Usar $COMMONAPPDATA\RadioIbizaPlayer inline.

!define RADIO_IBIZA_PD_NAME "RadioIbizaPlayer"

!ifdef BUILD_UNINSTALLER
Function un.radioIbizaStopAndRemoveStartup
  ClearErrors
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM "${PRODUCT_FILENAME}.exe" /T' $R9
  ClearErrors

  SetShellVarContext current
  Delete "$SMSTARTUP\Radio Ibiza.lnk"
  Delete "$SMSTARTUP\Desinstalar Radio Ibiza.lnk"
  Delete "$SMSTARTUP\Player Radio Ibiza.lnk"
  SetShellVarContext all
  Delete "$SMSTARTUP\Radio Ibiza.lnk"
  Delete "$SMSTARTUP\Desinstalar Radio Ibiza.lnk"
  Delete "$SMSTARTUP\Player Radio Ibiza.lnk"
  SetShellVarContext current

  SetShellVarContext current
  Delete "$DESKTOP\Radio Ibiza.lnk"
  Delete "$DESKTOP\Desinstalar Radio Ibiza.lnk"
  SetShellVarContext all
  Delete "$DESKTOP\Radio Ibiza.lnk"
  Delete "$DESKTOP\Desinstalar Radio Ibiza.lnk"
  SetShellVarContext current

  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Radio Ibiza"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_FILENAME}"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "Radio Ibiza"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_FILENAME}"
FunctionEnd

Function un.radioIbizaRemoveProgramData
  SetShellVarContext all
  ClearErrors
  RMDir /r "$COMMONAPPDATA\${RADIO_IBIZA_PD_NAME}"
  IfErrors 0 +2
  ExecWait '"$SYSDIR\cmd.exe" /c if exist "$COMMONAPPDATA\${RADIO_IBIZA_PD_NAME}" rd /s /q "$COMMONAPPDATA\${RADIO_IBIZA_PD_NAME}"' $R8
FunctionEnd
!endif

; Cria árvore ProgramData (per-machine, todos os utilizadores Windows).
Function radioIbizaCreateProgramDataFolders
  SetShellVarContext all
  CreateDirectory "$COMMONAPPDATA\${RADIO_IBIZA_PD_NAME}"
  CreateDirectory "$COMMONAPPDATA\${RADIO_IBIZA_PD_NAME}\pending-executions"
  CreateDirectory "$COMMONAPPDATA\${RADIO_IBIZA_PD_NAME}\audio"
  CreateDirectory "$COMMONAPPDATA\${RADIO_IBIZA_PD_NAME}\chromium-profile"
  CreateDirectory "$COMMONAPPDATA\${RADIO_IBIZA_PD_NAME}\chromium-cache"
FunctionEnd

; Built-in Users (BU) — FullAccess recursivo via icacls (SID fixo, PT/EN).
Function radioIbizaGrantBuFullAccess
  ClearErrors
  ExecWait '"$WINDIR\System32\icacls.exe" "$COMMONAPPDATA\${RADIO_IBIZA_PD_NAME}" /grant *S-1-5-32-545:(OI)(CI)F /T /C' $R0
  ExecWait '"$WINDIR\System32\icacls.exe" "$COMMONAPPDATA\${RADIO_IBIZA_PD_NAME}" /grant *S-1-5-11:(OI)(CI)M /T /C' $R1
FunctionEnd

; sessao.json vazio + ACL PowerShell (reforço + machine_device_id.txt).
Function radioIbizaSetupMultiUserData
  ExecWait '"$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\setup-programdata-acl.ps1"' $2
FunctionEnd

!macro customInstall
  SetShellVarContext all

  Call radioIbizaCreateProgramDataFolders
  Call radioIbizaGrantBuFullAccess
  Call radioIbizaSetupMultiUserData

  CreateShortCut "$INSTDIR\Radio Ibiza.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\RadioIbiza.ico" 0 "" "" "Radio Ibiza Player"
  CreateShortCut "$INSTDIR\Desinstalar Radio Ibiza.lnk" "$INSTDIR\${UNINSTALL_FILENAME}" "" "$INSTDIR\resources\RadioIbiza.ico" 0 "" "" "Desinstalar o Radio Ibiza"
  CreateShortCut "$SMPROGRAMS\Radio Ibiza\Radio Ibiza.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\RadioIbiza.ico" 0 "" "" "Radio Ibiza Player"
  CreateShortCut "$SMSTARTUP\Radio Ibiza.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\RadioIbiza.ico" 0 "" "" "Radio Ibiza Player"
  CreateShortCut "$DESKTOP\Radio Ibiza.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\RadioIbiza.ico" 0 "" "" "Radio Ibiza Player"

  CopyFiles /SILENT "$INSTDIR\resources\corrigir-permissoes-multiusuario.bat" "$INSTDIR\corrigir-permissoes-multiusuario.bat"
  CopyFiles /SILENT "$INSTDIR\resources\onde-esta-o-login.bat" "$INSTDIR\onde-esta-o-login.bat"

  SetShellVarContext current
  CreateShortCut "$DESKTOP\Radio Ibiza.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\RadioIbiza.ico" 0 "" "" "Radio Ibiza Player"
!macroend

!macro customUnInstall
  Call un.radioIbizaStopAndRemoveStartup
  Call un.radioIbizaRemoveProgramData
!macroend

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

!define RADIO_IBIZA_PROGRAMDATA "$COMMONAPPDATA\RadioIbizaPlayer"

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
  ClearErrors
  RMDir /r "${RADIO_IBIZA_PROGRAMDATA}"
  IfErrors 0 +2
  ExecWait '"$SYSDIR\cmd.exe" /c if exist "${RADIO_IBIZA_PROGRAMDATA}" rd /s /q "${RADIO_IBIZA_PROGRAMDATA}"' $R8
FunctionEnd
!endif

; Cria árvore ProgramData (per-machine, todos os utilizadores Windows).
Function radioIbizaCreateProgramDataFolders
  SetShellVarContext all
  CreateDirectory "${RADIO_IBIZA_PROGRAMDATA}"
  CreateDirectory "${RADIO_IBIZA_PROGRAMDATA}\pending-executions"
  CreateDirectory "${RADIO_IBIZA_PROGRAMDATA}\audio"
  CreateDirectory "${RADIO_IBIZA_PROGRAMDATA}\chromium-profile"
  CreateDirectory "${RADIO_IBIZA_PROGRAMDATA}\chromium-cache"
FunctionEnd

; Built-in Users (BU) — FullAccess recursivo via icacls (SID fixo, PT/EN).
Function radioIbizaGrantBuFullAccess
  ClearErrors
  ExecWait '"$WINDIR\System32\icacls.exe" "${RADIO_IBIZA_PROGRAMDATA}" /grant *S-1-5-32-545:(OI)(CI)F /T /C' $R0
  ExecWait '"$WINDIR\System32\icacls.exe" "${RADIO_IBIZA_PROGRAMDATA}" /grant *S-1-5-11:(OI)(CI)M /T /C' $R1
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

; Hook NSIS — instalador per-machine (electron-builder nsis.perMachine: true).
;
; ProgramData: C:\ProgramData\RadioIbizaPlayer\sessao.json
;
; NSIS: não concatenar $COMMONAPPDATA\RadioIbizaPlayer no script — \R vira escape
; e $COMMONAPPDATA/foo é lido como variável inválida. Usar ReadEnvStr + $R1.

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

Function un.radioIbizaGetDataDir
  SetShellVarContext all
  ReadEnvStr $R0 "ProgramData"
  StrCpy $R1 "$R0\$\\RadioIbizaPlayer"
FunctionEnd

Function un.radioIbizaRemoveProgramData
  Call un.radioIbizaGetDataDir
  ClearErrors
  RMDir /r "$R1"
FunctionEnd
!endif

; $R1 = C:\ProgramData\RadioIbizaPlayer (runtime, sem escapes NSIS)
Function radioIbizaGetDataDir
  SetShellVarContext all
  ReadEnvStr $R0 "ProgramData"
  StrCpy $R1 "$R0\$\\RadioIbizaPlayer"
FunctionEnd

Function radioIbizaCreateProgramDataFolders
  Call radioIbizaGetDataDir
  CreateDirectory "$R1"
  CreateDirectory "$R1/pending-executions"
  CreateDirectory "$R1/audio"
  CreateDirectory "$R1/chromium-profile"
  CreateDirectory "$R1/chromium-cache"
FunctionEnd

Function radioIbizaGrantBuFullAccess
  Call radioIbizaGetDataDir
  ClearErrors
  ExecWait '"$WINDIR\System32\icacls.exe" "$R1" /grant *S-1-5-32-545:(OI)(CI)F /T /C' $R0
  ExecWait '"$WINDIR\System32\icacls.exe" "$R1" /grant *S-1-5-11:(OI)(CI)M /T /C' $R0
FunctionEnd

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

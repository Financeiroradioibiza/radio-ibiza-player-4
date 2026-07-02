; Hook NSIS — instalador per-machine (electron-builder nsis.perMachine: true).
;
; ProgramData (sessao.json, ACL, build-stamp): feito pelo PowerShell no customInstall
; (setup-programdata-acl.ps1) — evita erros NSIS com caminhos \RadioIbizaPlayer.
;
; Desinstalação: apaga ProgramData via ReadEnvStr + $R1 (sem \ no script).

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
  ReadEnvStr $R0 "ProgramData"
  StrCpy $R1 "$R0/RadioIbizaPlayer"
  ClearErrors
  RMDir /r "$R1"
FunctionEnd
!endif

!macro customInstall
  SetShellVarContext all

  ExecWait '"$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\setup-programdata-acl.ps1"' $2

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

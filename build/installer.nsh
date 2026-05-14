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

!macro customInstall
  ; `SetShellVarContext all` + `$APPDATA` aponta para `C:\ProgramData\` no contexto
  ; do instalador elevado (perMachine). Isso é compatível com qualquer build do
  ; NSIS, diferente de `$COMMONAPPDATA` que só existe em versões recentes.
  SetShellVarContext all

  CreateDirectory "$APPDATA\RadioIbizaPlayer"
  CreateDirectory "$APPDATA\RadioIbizaPlayer\pending-executions"
  CreateDirectory "$APPDATA\RadioIbizaPlayer\audio"

  ; Concede modify (escrita + leitura + criar/apagar) a todos os usuários
  ; autenticados da máquina (`*S-1-5-11`). (OI)(CI) = aplica em todos os
  ; subdiretórios e arquivos. /T = recursivo, /C = ignora erros, /Q = silencioso.
  nsExec::Exec 'icacls "$APPDATA\RadioIbizaPlayer" /grant *S-1-5-11:(OI)(CI)M /T /C /Q'

  ; Restaura o contexto para o usuário corrente (boa prática NSIS).
  SetShellVarContext current
!macroend

!macro customUnInstall
  ; Não apagar o diretório de dados — preserva histórico do PDV caso o usuário
  ; reinstale depois. Se o cliente quiser limpar tudo, faz manualmente.
!macroend

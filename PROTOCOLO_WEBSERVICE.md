# Protocolo de Comunicação — Player ↔ Webservice Radio Ibiza

> Documento de referência mapeado a partir do código real do webservice (CakePHP) e do player AS3 original.
> Base URL atual em produção: `http://cloud.radioibiza.com.br/services/webservice/`
> Base URL alternativa (vista no código): `http://envyron.radioibiza.com.br/services/webservice/`

---

## 1. Fluxo geral de operação

```
┌──────────────────────────────────────────────────────────────────────────┐
│  1. PRIMEIRO ACESSO                                                       │
│     POST /login/  (email, password)                                       │
│         → resposta: { mensagem: ["valido", cliente_id] }                  │
│                                                                           │
│  2. SELECIONAR PDV                                                        │
│     GET /getPdvs/  (id=cliente_id, uf, cidade, nome)                     │
│         → lista de PDVs com seus tokens                                   │
│         → usuário escolhe um → token fica salvo localmente                │
│                                                                           │
│  3. VALIDAR TOKEN E PEGAR PERFIL                                          │
│     GET /loginByToken/?token=XXX                                          │
│         → { token: {...}, pdv: {...}, cliente: {...} }                   │
│                                                                           │
│  4. BAIXAR PROGRAMAÇÃO                                                    │
│     GET /playlist/?token=XXX                                              │
│         → { programa: {...}, playlists: [{musicas:[...]}, ...] }         │
│                                                                           │
│  5. BAIXAR AGENDAS E VINHETAS                                             │
│     GET /agendas/?token=XXX                                               │
│     GET /vinhetas_programadas/?token=XXX                                  │
│     GET /vinhetas_agendadas/?token=XXX                                    │
│                                                                           │
│  6. BAIXAR ARQUIVOS DE ÁUDIO                                              │
│     GET /get_musica/?token=XXX&id_musica=N&playlist_id=N                 │
│         → stream do MP3                                                   │
│     POST /save_atualizadas/  (marca como baixada)                         │
│                                                                           │
│  7. LOOP DE OPERAÇÃO                                                      │
│     a cada 60 minutos:                                                    │
│       GET /ping/?token=XXX&ma=MAC&ip=IP&pdv_atualizado=0|1&versao_player= │
│         → status do PDV, controles ativos                                 │
│     a cada música tocada:                                                 │
│       GET /save_executadas/?token=XXX&playlists_musica_id=N&...           │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Endpoints — referência completa

### 2.1 `POST /login/`
**Autentica um usuário (email/senha) e retorna o cliente_id.**

Request (form-encoded):
```
email=usuario@exemplo.com
password=senhaemtextoclaro
```

Response (sucesso):
```json
{ "mensagem": ["valido", "42"] }   // 42 = cliente_id
```

Response (falha):
```json
{ "mensagem": "usuario_invalido" }
```

⚠️ **A senha vai em texto claro**. Em produção isso só é aceitável se a chamada for via HTTPS. **VERIFICAR** se o servidor força HTTPS.

⚠️ A senha é hasheada server-side pelo CakePHP antes de comparar com o banco — o player não precisa saber como.

---

### 2.2 `GET /getPdvs/`
**Lista os PDVs disponíveis para um cliente, com seus tokens.**

Query params:
- `id` = cliente_id (do login)
- `uf` = sigla do estado (opcional)
- `cidade` = id da cidade (opcional)
- `nome` = filtro por nome do PDV (opcional)

Response: array de PDVs, cada um contém o `Token.token` que será usado daí em diante.

---

### 2.3 `GET /loginByToken/?token=XXX`
**Valida o token e retorna o "snapshot" do PDV/cliente. Equivalente ao `getProfile()` em APIs modernas.**

Query params:
- `token` (obrigatório)

Response (sucesso):
```json
[
  { "token": {
      "token": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "data_inicio": "2024-01-01 00:00:00",
      "data_fim":    "2026-01-01 00:00:00",
      "pdv_id": 123,
      "status": "ok"           // ou "token_vencido"
  }},
  { "pdv": {
      "id": 123, "nome": "Loja Centro",
      "status": "A",           // A=Ativo, I=Inativo
      "atualizacao_pendente": "S",
      "ctrl_player":     "S",  // pode controlar play/pause?
      "ctrl_placa_carro":"S",  // pode usar janela "veículos"?
      "ctrl_playlists":  "S",  // pode trocar playlist manualmente?
      "horarios_downloads": [...]
  }},
  { "cliente": {
      "id": 1, "nome": "Empresa X", "status": "A",
      "logotipo": "http://.../images/image?cliente=1"
  }}
]
```

Response (falha):
```json
{ "mensagem": "token_invalido" }
```

---

### 2.4 `GET /playlist/?token=XXX`
**O endpoint mais importante. Retorna toda a programação musical do PDV.**

Response:
```json
{
  "programa": { "id": 5, "nome": "Programa Padrão", ... },
  "playlists": [
    {
      "id": 10,
      "nome": "Pop Hits",
      "tipo": "N",                    // N=Normal, VP=Vinheta Programada, VA=Vinheta Agendada
      "tocar_sempre": "S",
      "tempo_total": "01:23:45",
      "musicas": [
        {
          "musica": {
            "id": 999,
            "playlist_musica_id": 1234,
            "titulo": "Nome da música",
            "nome_arquivo": "999.mp3",
            "tamanho_arquivo": "4521234",
            "duracao": "00:03:45",
            "corte": "00:00:05",       // segundos a cortar do início (fade-in)
            "downloaded": "0"          // 0=baixar, 1=já baixada
          },
          "artista": {
            "id": 555, "nome": "Artista X", "foto": "..."
          },
          "url_musica": "http://envyron.radioibiza.com.br/services/webservice/get_musica/?token=XXX&id_musica=999&playlist_id=10"
        }
      ]
    }
  ]
}
```

**Tipos de playlist** (importante!):
- `N`  = Playlist normal (música ambiente que toca em loop)
- `VP` = Vinheta Programada (toca a cada X minutos, regularmente)
- `VA` = Vinheta Agendada (toca em data/hora específica)

---

### 2.5 `GET /agendas/?token=XXX`
**Retorna as agendas (regras de quando cada playlist toca).**

Cada agenda tem: `dia_semana` (0=domingo a 6=sábado), `hora_inicio`, `hora_fim`, `playlist_id`, `tocar_cada` (intervalo em minutos para vinhetas), `tipo_tocar`, `data_agendada`, `data_fim`.

Query params:
- `token` (obrigatório)
- `agenda_atualizada` = 1 (opcional — marca como sincronizada no servidor)

---

### 2.6 `GET /vinhetas_programadas/?token=XXX` e `GET /vinhetas_agendadas/?token=XXX`
**Retornam os dados específicos das vinhetas (tipo VP e VA).** Estrutura semelhante ao `/playlist/` mas só com vinhetas.

---

### 2.7 `GET /get_musica/?token=XXX&id_musica=N&playlist_id=N`
**Stream/download do arquivo de áudio.**

Headers retornados:
```
Content-Type: audio/mpeg
Content-Length: <bytes>
Content-Disposition: attachment; filename="<nome>"
```

**Formato no disco do player antigo:** `cmf/cmfm/<playlist_id>_<playlist_nome>/mymusic_<musica_id>.cmfm`

⚠️ **A confirmar:** o arquivo `.cmfm` é MP3 puro (só renomeado) ou tem encriptação real via `awave.swc`? O servidor entrega `audio/mpeg` direto, então provavelmente é MP3 puro. **Testar baixando um arquivo real.**

Erro: retorna `die('Error: O arquivo X não foi encontrado!')` em texto puro (não JSON).

---

### 2.8 `GET /ping/`
**Heartbeat — chamado a cada `TIME_TO_PING = 60 minutos`. Reporta status e recebe comandos.**

Query params (todos no querystring, todos obrigatórios):
- `token`
- `ma` = MAC address do equipamento
- `ip` = IP local (informativo, o servidor já vê o IP real)
- `pdv_atualizado` = 0 ou 1 (se acabou de baixar conteúdo novo)
- `versao_player` = `"4.0_WEB"` (string livre — usar pra identificar o PWA)
- `tipo` (opcional)

Response: idêntico ao `/loginByToken/` — retorna `{ pdv: {...} }` atualizado, com:
- `pdv.status` — se for diferente de `"A"`, o player **deve parar de tocar**
- `pdv.ctrl_player`, `pdv.ctrl_placa_carro`, `pdv.ctrl_playlists` — permissões a respeitar
- `pdv.atualizacao_pendente` — se `"S"`, baixar `/playlist/` de novo
- `mensagem`: `"token_invalido"` (forçar logout), `"ping_salvo"`

**Limite de tolerância (do código original):** se o servidor ficar inacessível por **18h × 30 dias = 540 pings**, o player se autodesativa. Replicar essa lógica no PWA.

---

### 2.9 `POST /save_executadas/`
**Reporta que uma música acabou de tocar (analytics).**

Query params:
- `token`
- `playlists_musica_id` = id da relação playlist↔música (não é o id da música!)
- `data_execucao` = `"YYYY-MM-DD HH:mm:ss"`
- `ind_termino` = 0 (interrompida) ou 1 (terminou normal)

Pode ser chamado de forma "fire-and-forget". Erros não impedem a operação do player.

---

### 2.10 `POST /save_atualizadas/`
**Reporta que arquivos de música acabaram de ser baixados (sincroniza estado de download).**

Query params:
- `token`
- `musicas` = array com ids das músicas baixadas

---

### 2.11 `GET /player/`
**Retorna a versão mais recente do player publicada no painel (.exe/.dmg).**

Response:
```json
{ "atualizacao": {
    "versao": "2.7",
    "pathToFile": "http://.../uploads/players/player.exe"
}}
```

**Para o PWA:** podemos ignorar esse endpoint (PWA atualiza sozinho via Service Worker), ou usar pra exibir uma notificação quando houver versão nova publicada no servidor.

---

### 2.12 Endpoints auxiliares
- `GET /getStates/` — lista de UFs
- `GET /getCitiesByUf/?uf=SP` — cidades de uma UF
- `GET /logotipo_cliente/?token=XXX` — devolve o logo binário do cliente
- `GET /set_agenda_atualizada/?token=XXX` — marca a agenda como sincronizada

---

## 3. Estado local que o PWA precisa manter

Tudo isso ficava no SQLite local (`radioib.sqlite`) do player antigo. No PWA vamos usar **IndexedDB**:

| Dado | Origem | Uso |
|------|--------|-----|
| `token` | `loginByToken` | Authorization de toda chamada subsequente |
| `objPlaylists` | `/playlist/` | Programação completa (cache) |
| `objAgenda`    | `/agendas/`  | Quando cada playlist toca |
| `arquivos de música` | `/get_musica/` | Cache offline (Cache Storage API) |
| `ping_times` | contador local | Quantos pings falharam consecutivamente |
| `ping` | última resposta de `/ping/` | Cache do estado do PDV |
| `last_update` | local | Data do último download de conteúdo |
| `restart_player`, `time_restart_player` | configs locais | Auto-reinício diário |
| `executadas pendentes` | local | Filas de chamadas a `/save_executadas/` quando offline |

---

## 4. Lógicas críticas a portar

### 4.1 Loop principal (do `Player.as`)
1. Carregar `objPlaylists` do IndexedDB
2. Selecionar playlist atual via `VerificarProgramacao` (lê `objAgenda`, escolhe a primeira que bate `dia_semana + hora_atual` — ou usa `tocar_sempre = 'S'` como fallback)
3. Sortear música random da playlist (sem repetir as últimas N)
4. Carregar arquivo do Cache Storage; se não existir, baixar via `/get_musica/` e cachear
5. Tocar com fade-in (`corte` segundos) e fade-out
6. Ao final, chamar `/save_executadas/` (fila se offline)
7. A cada N músicas verificar se há vinheta programada (`tipo: VP`) ou agendada (`tipo: VA`) que precise tocar
8. Voltar ao passo 2

### 4.2 Sincronização de conteúdo
- A cada ping com `pdv.atualizacao_pendente == 'S'` OU primeiro login: baixar `/playlist/` completo
- Comparar `musica.downloaded` — só baixa as `"0"`
- Em paralelo (com limite de concorrência, tipo 3 simultâneas) baixar os MP3
- Ao completar, marcar `pdv_atualizado=1` no próximo ping
- Limpar arquivos órfãos (que não estão mais em `objPlaylists`)

### 4.3 Tolerância a falhas
- Ping falhou: incrementar contador local. Se passar de 540, desativar player (mostra mensagem "Player desativado").
- Sem internet ao iniciar: usar última `objPlaylists` do IndexedDB e tocar normalmente offline.
- Música não está no cache: pular pra próxima.
- Token expirou (`mensagem: "token_invalido"`): limpar tudo, voltar pra tela de login.

### 4.4 Permissões dinâmicas (vindas do ping)
- `ctrl_player == 'N'` → esconder/desabilitar botões play/pause/next/prev
- `ctrl_playlists == 'N'` → bloquear janela de seleção manual de playlist
- `ctrl_placa_carro == 'N'` → esconder o botão "Veículos"

---

## 5. Limitações conhecidas e decisões pendentes

1. **Formato do áudio:** confirmar se é MP3 puro ou tem `awave.swc` envolvido.
2. **CORS:** o webservice atualmente não envia headers CORS. Precisa configurar no servidor OU usar um proxy (Cloudflare Worker, ou um endpoint próprio que faz o relay).
3. **HTTPS:** o webservice está em `http://` no `Config.as`. Pra um PWA funcionar (Service Worker exige HTTPS), o webservice precisa estar acessível via HTTPS — mesmo que seja um proxy reverso na frente.
4. **Token na URL:** vai aparecer em logs do servidor. Não é o ideal mas é o que temos sem mexer no PHP. Em horizonte 2, mover pra header `Authorization`.
5. **Background playback:** se o usuário fechar a aba, para de tocar. Pra PDV, precisa instruir o operador a deixar a aba aberta OU partir pra Electron.

/**
 * Tipos baseados nas respostas reais do webservice Radio Ibiza.
 * Mapeados a partir de /services/app/Controller/WebserviceController.php
 *
 * IMPORTANTE: o backend é um CakePHP antigo e tem várias inconsistências —
 * alguns campos vêm como string "S"/"N" em vez de boolean, datas como string,
 * IDs às vezes como number, às vezes como string. Os types refletem a realidade.
 */

// ============================================================================
// LOGIN (POST /login/)
// ============================================================================

export interface LoginResponse {
  /**
   * Em sucesso: ["valido", "<cliente_id_como_string>"]
   * Em falha:   "usuario_invalido" | "metodo_invalido"
   */
  mensagem: ['valido', string] | string;
}

// ============================================================================
// PDV (GET /getPdvs/, /loginByToken/, /ping/)
// ============================================================================

export interface Token {
  token: string;
  data_inicio: string; // "YYYY-MM-DD HH:mm:ss"
  /** No servidor pode vir `null` se ainda válido */
  data_fim: string | null;
  pdv_id: number | string;
  status?: 'ok' | 'token_vencido';
}

export type FlagSN = 'S' | 'N'; // padrão de "boolean string" do CakePHP antigo

export interface PdvData {
  id: number;
  nome: string;
  status: 'A' | 'I'; // Ativo / Inativo
  atualizacao_pendente: FlagSN;
  atualizacao_pendente_agenda?: FlagSN;
  date_last_update?: string;
  versao_player?: string;

  // Permissões — controlam o que o operador pode fazer no player
  /** `N` também dispara aviso vermelho de necessidade cadastral no player (`mensagensAvisoVermelhoCadastroPdv`). */
  ctrl_player?: FlagSN;       // pode dar play/pause/next/prev
  ctrl_placa_carro?: FlagSN;  // pode usar janela "Veículos"
  /** `N` também dispara aviso vermelho de pendência financeira / Cobrança (`mensagensAvisoVermelhoCadastroPdv`). */
  ctrl_playlists?: FlagSN;    // pode trocar playlist manualmente

  horarios_downloads?: HorarioDownload[];

  /**
   * Serial/chave de instalação emitida pelo painel (se o webservice expuser no JSON do PDV).
   * O player grava uma cópia na primeira sincronização e compara a cada `/ping/`.
   */
  serial_instalacao?: string;

  /**
   * Nome completo do contato extra (cadastro). Só dois valores literais disparam aviso na UI:
   * `ALERTACORTE` e `CADASTRO` — ver `mensagemAvisoCodigoContatoExtra`.
   */
  nome_completo_contato_extra?: string | null;

  // Outros campos do schema que podem aparecer
  [key: string]: unknown;
}

export interface HorarioDownload {
  id: number;
  horario_ini: string; // "HH:mm:ss"
  horario_fim: string;
  Total: string; // velocidade em alguma unidade (kbps?)
}

export interface ClienteData {
  id: number;
  nome: string;
  status: 'A' | 'I';
  logotipo: string; // URL completa

  /** Campos extras comuns na resposta do CakePHP */
  [key: string]: unknown;
}

// ============================================================================
// GET /getPdvs/
// ============================================================================

/** Uma linha típica de `mensagem[]` em /getPdvs/ (nomes de model CakePHP) */
export interface GetPdvsRow {
  Pdv: Record<string, unknown>;
  Cliente: Record<string, unknown>;
  Token: Array<Record<string, unknown>>;
  PdvPlaylist?: unknown[];
}

export type GetPdvsApiResponse =
  | { mensagem: GetPdvsRow[] }
  | { mensagem: string };

/** Item já mapeado para a UI e para `loginByToken` */
export interface PdvListItem {
  token: string;
  nome: string;
  cidade: string;
  uf: string;
  status: 'A' | 'I';
  atualizacao_pendente: FlagSN;
}

export type GetPdvsResult =
  | {
      ok: true;
      items: PdvListItem[];
      /** Linhas com `status: I` vindas do servidor — não entram em `items` (lista de escolha só com ativos). */
      ocultadosInativos: number;
    }
  | { ok: false; error: string };

/**
 * Resposta de /loginByToken/ e do bloco principal de /ping/.
 * Note que vem como ARRAY de objetos com uma chave cada.
 */
export type LoginByTokenResponse =
  | Array<{ token?: Token; pdv?: PdvData; cliente?: ClienteData }>
  | { mensagem: string };

export interface PingResponse {
  pdv: PdvData;
  mensagem: 'ping_salvo' | 'token_invalido' | 'registro_nao_salvo_1' | 'registro_nao_salvo_2' | string;
}

// ============================================================================
// PLAYLISTS (GET /playlist/)
// ============================================================================

/**
 * Tipos de playlist:
 * - N  = Normal (música ambiente em loop)
 * - VP = Vinheta Programada (toca a cada X minutos)
 * - VA = Vinheta Agendada (toca em data/hora específica)
 */
export type TipoPlaylist = 'N' | 'VP' | 'VA';

export interface Musica {
  id: number;
  playlist_musica_id: string; // (sim, é string no JSON)
  titulo: string;
  nome_arquivo: string;
  tamanho_arquivo: string; // bytes como string
  duracao: string; // "HH:mm:ss"
  corte: string;   // segundos para fade-in (ex: "5")
  downloaded: '0' | '1';
}

export interface Artista {
  id: number;
  nome: string;
  foto: string;
}

export interface MusicaCompleta {
  musica: Musica;
  artista: Artista;
  url_musica: string; // URL completa para download (já com token embutido)
}

export interface Playlist {
  id: number;
  nome: string;
  tipo: TipoPlaylist;
  tocar_sempre: FlagSN;
  tempo_total: string; // "HH:mm:ss"
  musicas: MusicaCompleta[];
  /**
   * VP/VA legados podem trazer a configuração de cadência diretamente na playlist
   * (quando o painel não cria uma linha completa em `/agendas/`):
   * - `tocar_cada`: quantidade — minutos (padrão) ou músicas (se `tipo_tocar` indicar).
   * - `tipo_tocar`: rótulo livre do painel; presença de «musica»/«faixa» ⇒ conta por música.
   */
  tocar_cada?: number | null;
  tipo_tocar?: string | null;
}

export interface Programa {
  id: number;
  nome: string;
  cliente_id?: number;
  [key: string]: unknown;
}

export interface PlaylistResponse {
  programa: Programa;
  playlists: Playlist[];
  mensagem?: string;
}

// ============================================================================
// AGENDAS (GET /agendas/)
// ============================================================================

export interface Agenda {
  id: number;
  programa_id: number;
  playlist_id: number;
  /** 0=domingo, 1=segunda, ..., 6=sábado */
  dia_semana: number | string;
  hora_inicio: string; // "HH:mm:ss"
  hora_fim: string;
  data_agendada?: string;
  data_fim?: string;
  tocar_cada?: number;
  /** VP: se contiver «musica»/«faixa» (tipo_tocar), `tocar_cada` conta músicas ambiente; caso contrário, minutos. */
  tipo_tocar?: string;
}

export interface AgendaResponse {
  agendas?: Agenda[];
  mensagem?: string;
  // backend pode retornar formatos diferentes — tratar dinamicamente
  [key: string]: unknown;
}

// ============================================================================
// SAVE_EXECUTADAS / SAVE_ATUALIZADAS
// ============================================================================

export interface SaveExecutadaParams {
  token: string;
  playlists_musica_id: number;
  data_execucao: string; // "YYYY-MM-DD HH:mm:ss"
  /** 0 = interrompida, 1 = terminou normalmente */
  ind_termino: 0 | 1;
}

export interface SaveAtualizadasParams {
  token: string;
  /** Ids das músicas salvas (`musica.id` no `/playlist/`). */
  musica_ids: number[];
  /**
   * `programa.id` do `/playlist/` — no PHP legado cada aviso de download vai em
   * `GET .../save_atualizadas/?token=&musica_id=&id_programa=&percentual=`; isso alimenta
   * `atualizadas.programa_id` e a barra «%» do painel (`totalBaixadasPorPdv`).
   */
  id_programa?: number;
}

// ============================================================================
// LOCAL DOMAIN (modelos para IndexedDB) — não vêm do servidor
// ============================================================================

/**
 * Sessão atual do PDV — equivale ao registro único da tabela `playlists`
 * no SQLite do player AS3 antigo. Sempre tem rowid=1.
 */
export interface SessaoLocal {
  id: 1; // sempre 1
  token: Token | null;
  cliente_id: number | null;
  cliente: ClienteData | null;
  pdv: PdvData | null;
  playlists_data: PlaylistResponse | null;
  agendas_data: Agenda[] | null;
  ping_times: number; // contador de pings falhos consecutivos
  last_update: string | null;
  primeiro_acesso: boolean;

  /**
   * UUID estável do navegador (`getDeviceId` / localStorage) gravado na **primeira**
   * ativação neste aparelho. Se copiarem só o IndexedDB para outro PC, o ID não bate
   * e a sessão é recusada (proteção leve — não substitui validação no servidor).
   */
  install_device_id: string | null;

  /**
   * Chave/serial informada na instalação (painel). Reenviada em cada `/ping/` para o
   * backend poder validar quando houver suporte; até lá o campo segue útil no cliente.
   */
  install_serial: string | null;
}

/**
 * Configurações do usuário (janela de configs do player antigo).
 */
export interface ConfigsLocal {
  id: 1;
  restart_player: boolean;
  time_restart_player: string; // "HH:mm"
}

/**
 * Fila de execuções a serem reportadas ao webservice.
 * Quando offline, acumulam aqui e são enviadas no próximo online.
 */
export interface ExecucaoPendente {
  id?: number; // auto-increment
  playlists_musica_id: number;
  data_execucao: string;
  ind_termino: 0 | 1;
  tentativas: number;
}

/**
 * Metadados de música baixada localmente. O blob de áudio em si
 * fica no Cache Storage (não no IndexedDB) por questão de tamanho.
 */
export interface MusicaCacheada {
  musica_id: number;
  /** Join playlist↔faixa no `/playlist/` (local / save_executadas). */
  playlist_musica_id?: number;
  playlist_id: number;
  nome_arquivo: string;
  tamanho_bytes: number;
  baixada_em: string;
  cache_key: string; // chave no Cache Storage
}

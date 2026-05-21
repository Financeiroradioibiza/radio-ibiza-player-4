# Histórico de deploys — PWA Netlify (`main`)

Registo **em texto** do que já foi para produção em `player4.radioibiza.com.br` quando se faz push a `main` (deploy automático Netlify). Complementa o `git log` com linguagem mais legível para operação/comercial.

## Onde está documentado quê

| Fonte | Conteúdo |
|-------|-----------|
| **`git log` / commits em `main`** | Registo técnico autoritativo, diff completo |
| **`package.json`** (`ibizaShellVersion`, `ibizaShellVersionMobile`) | Micro-referência nos rodapés do player (desktop e `/m/player`); deve subir quando o deploy vale rastreamento rápido |
| **`docs/VERSOES.md`** | Releases **semver com tag git** (`v4.0.x-WEB`, etc.), procedimento formal de release |
| **`docs/DECISIONS.md`** | Decisões de arquitetura (DEC-009, …), não changelog operacional |
| **Este ficheiro** | Resumo corrido das melhorias/correcções já em produção por deploy |

## Manutenção recomendada

Em cada deploy intencional a produção:

1. Garantir que `ibizaShellVersion` / `ibizaShellVersionMobile` foram incrementados quando fizer sentido (já há essa convenção no projecto).
2. Acrescentar aqui uma subsecção com **data (UTC ou BR, consistente)** + **hash curto do commit** + bullets em português claro.

---

## Registo (mais recente primeiro)

### 2026-05-xx — deploy `794316d` · shell **4.0.0023**

- **Pastas selecionáveis (EVENTO / EXTRA)**: qualquer pasta ambiente cujo nome contém as palavras **Evento** ou **Extra** (ex.: «Evento - Dia de luxo»); critério com limite de palavra inteira (`\b`), para não confundir com «eventos» no plural etc.
- **Ping / painel**: `versao_player` em iPhone/iPad passa a usar o sufixo **`ios`** (ex.: `4.0ios`) em lugar de `wi`; `DECISIONS.md` (DEC-009) actualizado.
- **Som no iPhone ao abrir**: com o player já em «tocando», o primeiro áudio pode ficar calado até pausar/trocar faixa — corrigido: actualizações de playlist com **`preservePlayback`** já não incrementam `playbackIntent` de forma a abortar `eng.play()` a meio do carregamento.
- Painel Playlists (textos de ajuda quando não há pastas nas listas).

### 2026-05-xx — deploy `be7fc8c` · shell **~4.0.0020**

- **Mobile `/m/player`**: com aviso vermelho (`PainelAvisoIePdv`), o bloco TOCANDO/transportf compacta (padding, gaps, botões menores, `line-clamp`) para não empurrar «Atualizar cadastro» e a linha «Versão» para fora do ecrã.

### Deploys anteriores (resumo; pormenores em `git log`)

Histórico condensado – cada linha corresponde a um ou mais merges a `main` já em produção.

| Commit (exemplo) | Tema principal |
|------------------|----------------|
| `477d6f3` | Sessão ícone iOS / PWA alinhamento `device_id` IndexedDB; saída do login coerente |
| `4fd31cf`, `69ecd00`, `affbf61` | Guia `/m/instalar`, detecção de browsers no iOS, textos Android vs iOS |
| `878dd0b` | Layout `/m/player` com scroll / `svh` para caber em ecrãs baixos |
| `daa91e6`, `f3e8881` | Rodapé: contagem de pings; modo pasta EVENTO/EXTRA original (antes da extensão por nome) + menu Avisos |
| `86a3553` | Tablet `/m/player` e detecção touch |
| `9bd2240`, `54ec5f9` | Rotas `/m`, shells desktop/mobile, Vite 8, TWA pasta `mobile/` |
| `c501d4f`, `966a8f4`, `d6f7171`, `de6772b`, … | Android/Linux UA, banners instalação, layout mobile/tablet (`dvh`/ecrã cheio), reprodução com cache |

---

*Última actualização manual deste ficheiro no mesmo push que consolidou shell **4.0.0023** (`794316d`).*

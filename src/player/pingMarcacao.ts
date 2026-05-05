/**
 * O AS3 manda `pdv_atualizado=1` no ping **depois** de baixar conteúdo novo.
 * Coordenamos isso entre a sync inicial e o hook de ping (sem prop drilling).
 */
export const pingMarcacao = {
  _pendente: false as boolean,

  aposBaixarConteudo() {
    this._pendente = true;
  },

  flagsParaProximoPing(): 0 | 1 {
    return this._pendente ? 1 : 0;
  },

  /** Só libera flag depois que o ping que carregou 1 foi aceito pelo servidor */
  registrarPingSucessoComFlag(flag: 0 | 1) {
    if (flag === 1) this._pendente = false;
  },
};

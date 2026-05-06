/** Texto falado no aviso de veículo (pt-BR). */

export const AVISO_VEICULO_LIMITS = {
  marca: 48,
  modelo: 72,
  placa: 16,
  cor: 40,
} as const;

export interface AvisoVeiculoFields {
  marca: string;
  modelo: string;
  placa: string;
  cor: string;
}

function trimField(s: string, max: number): string {
  return s.trim().slice(0, max);
}

export function sanitizeAvisoVeiculoFields(raw: AvisoVeiculoFields): AvisoVeiculoFields {
  return {
    marca: trimField(raw.marca, AVISO_VEICULO_LIMITS.marca),
    modelo: trimField(raw.modelo, AVISO_VEICULO_LIMITS.modelo),
    placa: trimField(raw.placa, AVISO_VEICULO_LIMITS.placa),
    cor: trimField(raw.cor, AVISO_VEICULO_LIMITS.cor),
  };
}

/** Frase única para TTS — vírgulas ajudam a pausa natural na maioria dos motores. */
export function buildAvisoVeiculoSpeech(fields: AvisoVeiculoFields): string {
  const { marca, modelo, placa, cor } = sanitizeAvisoVeiculoFields(fields);
  return `Atenção, proprietário do veículo ${marca}, ${modelo}, placa ${placa}, cor ${cor}, favor compareça ao seu veículo.`;
}

export function isAvisoVeiculoFormComplete(fields: AvisoVeiculoFields): boolean {
  const s = sanitizeAvisoVeiculoFields(fields);
  return Boolean(s.marca && s.modelo && s.placa && s.cor);
}

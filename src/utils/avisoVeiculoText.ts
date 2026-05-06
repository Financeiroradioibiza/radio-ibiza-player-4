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

/** Placa sem espaços, maiúsculas (símbolos preservados para soletrar). */
export function normalizePlacaDigits(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

/** Texto mostrado na UI — espelha pausas e soletração da placa no áudio gerado. */
export function buildAvisoVeiculoSpeech(fields: AvisoVeiculoFields): string {
  const { marca, modelo, placa, cor } = sanitizeAvisoVeiculoFields(fields);
  const pn = normalizePlacaDigits(placa);
  const soletrado = [...pn].join(' · ');
  return [
    'Atenção, proprietário do veículo.',
    '— pausa —',
    `${marca}, ${modelo}.`,
    '— pausa —',
    `Cor, ${cor}.`,
    '— pausa —',
    'Placa, letra a letra:',
    soletrado,
    '— pausa —',
    'Favor compareça ao seu veículo.',
  ].join('\n');
}

export function isAvisoVeiculoFormComplete(fields: AvisoVeiculoFields): boolean {
  const s = sanitizeAvisoVeiculoFields(fields);
  return Boolean(s.marca && s.modelo && s.placa && s.cor);
}

/** Último aviso guardado só em RAM (sessão do player — some no logout / fecho). */
export interface SavedVehicleAnnouncementClip {
  blob: Blob;
  /** Resumo na UI */
  label: string;
}

export function buildSavedVehicleAnnouncementLabel(fields: AvisoVeiculoFields): string {
  const s = sanitizeAvisoVeiculoFields(fields);
  return `${s.placa} · ${s.marca} ${s.modelo} — ${s.cor}`;
}

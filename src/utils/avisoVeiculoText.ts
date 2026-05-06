/** Repetições ao tocar o MP3 gerado (evita números absurdos). */
export const AVISO_VEICULO_REPETICOES_PADRAO = 2;
export const AVISO_VEICULO_REPETICOES_MIN = 1;
export const AVISO_VEICULO_REPETICOES_MAX = 99;

export function clampAvisoVeiculoRepeticoes(n: unknown): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return AVISO_VEICULO_REPETICOES_PADRAO;
  return Math.min(
    AVISO_VEICULO_REPETICOES_MAX,
    Math.max(AVISO_VEICULO_REPETICOES_MIN, Math.floor(x)),
  );
}

/** Formulário / limites do aviso de veículo. */

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

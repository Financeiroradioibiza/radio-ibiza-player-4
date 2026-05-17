/** Chave localStorage — manter igual ao script inline em `index.html`. */
export const UI_THEME_LS_KEY = 'radio_ibiza_ui_theme';

export type UiTheme = 'night' | 'day';

export function readUiThemeFromStorage(): UiTheme {
  try {
    const v = localStorage.getItem(UI_THEME_LS_KEY);
    if (v === 'day' || v === 'night') return v;
  } catch {
    //
  }
  return 'night';
}

export function applyUiThemeToDocument(theme: UiTheme): void {
  document.documentElement.setAttribute('data-ui-theme', theme);
}

import { create } from 'zustand';

import {
  UI_THEME_LS_KEY,
  applyUiThemeToDocument,
  readUiThemeFromStorage,
  type UiTheme,
} from '@/theme/uiThemeConstants';

type UiThemeState = {
  theme: UiTheme;
  setTheme: (t: UiTheme) => void;
  toggleTheme: () => void;
};

export const useUiThemeStore = create<UiThemeState>((set, get) => ({
  theme: readUiThemeFromStorage(),
  setTheme: (t) => {
    try {
      localStorage.setItem(UI_THEME_LS_KEY, t);
    } catch {
      //
    }
    applyUiThemeToDocument(t);
    set({ theme: t });
  },
  toggleTheme: () => {
    const next = get().theme === 'night' ? 'day' : 'night';
    get().setTheme(next);
  },
}));

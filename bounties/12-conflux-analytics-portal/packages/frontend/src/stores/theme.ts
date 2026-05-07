import { create } from 'zustand';

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

/** Light/dark theme toggle. Persists to <html> class for Tailwind dark mode. */
export const useThemeStore = create<ThemeState>((set) => ({
  dark: false,
  toggle: () =>
    set((state) => {
      const next = !state.dark;
      document.documentElement.classList.toggle('dark', next);
      return { dark: next };
    }),
}));

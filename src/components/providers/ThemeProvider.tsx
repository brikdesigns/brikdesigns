'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Light/dark theme provider for brikdesigns.com.
 *
 * The inline script in layout.tsx sets data-theme on <html> before hydration
 * to prevent flash of wrong theme (FOUC). This provider syncs React state
 * with that attribute and provides toggle functionality.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Sync React state with the data-theme attribute the anti-FOUC inline
    // script in layout.tsx wrote before hydration. Initial render must match
    // SSR ('light') so this can't run during render or via a lazy useState
    // initializer — both would diverge from SSR and break hydration on the
    // ThemeToggle (which renders isDark-dependent visuals).
    const current = document.documentElement.dataset.theme as Theme;
    if (current === 'light' || current === 'dark') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(current);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

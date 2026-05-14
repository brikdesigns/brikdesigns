'use client';

import { Switch } from '@brikdesigns/bds';
import { useTheme } from '@/components/providers/ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Switch
      size="sm"
      checked={theme === 'dark'}
      onChange={() => toggleTheme()}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    />
  );
}

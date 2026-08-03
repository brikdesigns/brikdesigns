'use client';

import { ToggleSwitch } from '@brikdesigns/bds';
import { useTheme } from '@/components/providers/ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <ToggleSwitch
      size="sm"
      variant="accent-knob"
      checked={theme === 'dark'}
      onChange={() => toggleTheme()}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    />
  );
}

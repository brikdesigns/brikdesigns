'use client';

import { useTheme } from '@/components/providers/ThemeProvider';

/**
 * Theme toggle — matches Webflow: .theme-toggle.icon-light / .theme-toggle.icon-dark
 * Pill-shaped toggle with a sliding dot. Light mode: white bg + dark dot.
 * Dark mode: dark bg + white dot aligned right.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="theme-toggle"
      style={{
        /* Webflow: .theme-toggle.icon-light / .theme-toggle.icon-dark */
        display: 'flex',
        alignItems: 'center',
        justifyContent: isDark ? 'flex-end' : 'flex-start',
        width: '3rem',
        padding: '0.25rem',
        borderRadius: '1.5rem',
        border: `1px solid ${isDark ? 'transparent' : 'var(--border-input)'}`,
        backgroundColor: isDark ? 'var(--grayscale--darkest)' : 'var(--grayscale--white)',
        cursor: 'pointer',
        transition: 'background-color 0.2s, border-color 0.2s',
      }}
    >
      {/* Webflow: .toggle_dot / .toggle_dot.inverse */}
      <span
        style={{
          width: 'var(--padding-md)',
          height: 'var(--padding-md)',
          borderRadius: '1rem',
          backgroundColor: isDark ? 'var(--grayscale--white)' : 'var(--grayscale--black)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transition: 'background-color 0.2s',
          fontSize: '8px',
        }}
      >
        {/* Webflow: .icon_tiny — sun/moon icon inside dot */}
        <span style={{
          fontFamily: "'Font Awesome 6 Pro', 'Font Awesome 6 Free', sans-serif",
          color: isDark ? 'var(--grayscale--darkest)' : 'var(--grayscale--white)',
          fontSize: '8px',
          lineHeight: 1,
        }}>
          {isDark ? '\uf185' : '\uf186'}
        </span>
      </span>
    </button>
  );
}

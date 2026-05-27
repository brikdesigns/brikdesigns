'use client';

import { Select, type SelectOptionGroup } from '@brikdesigns/bds';
import type { BdsColorToken } from '@/lib/bds-color-tokens';

export interface BdsColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Server-parsed tokens (grouped by family). Pass via server component → client. */
  groups: { family: string; tokens: BdsColorToken[] }[];
  /** Flat token list — used to resolve the swatch for the current selection. */
  flat: BdsColorToken[];
}

function resolveSwatch(value: string, flat: BdsColorToken[]): string | null {
  if (!value) return null;
  if (value.startsWith('#')) return value;
  if (value.startsWith('--')) {
    const match = flat.find((t) => t.name === value);
    return match?.value ?? null;
  }
  return null;
}

export function BdsColorPicker({
  label,
  value,
  onChange,
  groups,
  flat,
}: BdsColorPickerProps) {
  const swatch = resolveSwatch(value, flat);
  const isLegacyHex = value.startsWith('#');

  const options: SelectOptionGroup[] = groups.map((g) => ({
    label: g.family.replace(/-/g, ' '),
    options: g.tokens.map((t) => ({
      label: `${t.tier}  ·  ${t.value}`,
      value: t.name,
    })),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)' }}>
      <Select
        label={label}
        options={options}
        value={value.startsWith('--') ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isLegacyHex ? `Legacy hex: ${value} — pick a token to migrate` : 'Select a token…'}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-sm)',
          fontFamily: 'var(--font-family-body)',
          fontSize: 'var(--body-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: '20px',
            height: '20px',
            borderRadius: 'var(--border-radius-sm)',
            border: 'var(--border-width-md) solid var(--border-primary)',
            backgroundColor: swatch ?? 'transparent',
            backgroundImage: swatch
              ? undefined
              : 'linear-gradient(45deg, var(--surface-secondary) 25%, transparent 25%, transparent 75%, var(--surface-secondary) 75%), linear-gradient(45deg, var(--surface-secondary) 25%, transparent 25%, transparent 75%, var(--surface-secondary) 75%)',
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 4px 4px',
          }}
        />
        <code style={{ fontFamily: 'var(--font-family-system)' }}>{value || '(none)'}</code>
        {isLegacyHex && (
          <span style={{ color: 'var(--text-warning)' }}>· legacy hex</span>
        )}
      </div>
    </div>
  );
}

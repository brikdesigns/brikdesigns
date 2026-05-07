'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { TextInput } from '@bds/components/ui/TextInput/TextInput';
import { TextArea } from '@bds/components/ui/TextArea/TextArea';
import { Select, type SelectOption } from '@bds/components/ui/Select/Select';
import { Switch } from '@bds/components/ui/Switch/Switch';
import { Button } from '@bds/components/ui/Button/Button';

export type FieldDef =
  | { kind: 'text'; name: string; label: string; required?: boolean; placeholder?: string }
  | { kind: 'textarea'; name: string; label: string; rows?: number }
  | { kind: 'number'; name: string; label: string }
  | { kind: 'switch'; name: string; label: string }
  | {
      kind: 'select';
      name: string;
      label: string;
      options: SelectOption[];
      required?: boolean;
      placeholder?: string;
    };

export interface EntityFormProps {
  /** Field schema in render order. Group with section breaks via `sectionTitle`. */
  fields: (FieldDef | { sectionTitle: string })[];
  /** Initial values keyed by field `name`. Pass `{}` for create. */
  initial: Record<string, unknown>;
  /** Endpoint for the submit. POST when `mode === 'create'`, PATCH otherwise. */
  endpoint: string;
  /** Form mode — controls verb + ID handling. */
  mode: 'create' | 'edit';
  /** ID required for `edit`; appended to endpoint as `/${id}`. */
  id?: string;
  /** Where to navigate after a successful save. */
  successHref: string;
  /** Optional pre-submit hook to mutate the payload (e.g. coerce numeric strings). */
  onBeforeSubmit?: (payload: Record<string, unknown>) => Record<string, unknown>;
}

function fieldDefaultValue(def: FieldDef, initial: Record<string, unknown>): unknown {
  const v = initial[def.name];
  if (v === undefined || v === null) {
    if (def.kind === 'switch') return false;
    if (def.kind === 'number') return '';
    return '';
  }
  return v;
}

export function EntityForm({
  fields,
  initial,
  endpoint,
  mode,
  id,
  successHref,
  onBeforeSubmit,
}: EntityFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const seed: Record<string, unknown> = {};
    for (const f of fields) {
      if ('sectionTitle' in f) continue;
      seed[f.name] = fieldDefaultValue(f, initial);
    }
    return seed;
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function setValue(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    let payload: Record<string, unknown> = {};
    for (const f of fields) {
      if ('sectionTitle' in f) continue;
      const v = values[f.name];
      if (f.kind === 'number') {
        if (v === '' || v === null || v === undefined) {
          payload[f.name] = 0;
        } else {
          const n = typeof v === 'number' ? v : Number(v);
          if (!Number.isFinite(n)) {
            setError(`${f.label} must be a number`);
            setSaving(false);
            return;
          }
          payload[f.name] = n;
        }
      } else if (f.kind === 'switch') {
        payload[f.name] = Boolean(v);
      } else if (f.kind === 'select') {
        const s = typeof v === 'string' ? v : '';
        if (!s) {
          if (f.required) {
            setError(`${f.label} is required`);
            setSaving(false);
            return;
          }
          continue;
        }
        payload[f.name] = s;
      } else if (f.kind === 'text' || f.kind === 'textarea') {
        const s = typeof v === 'string' ? v : '';
        if (!s) {
          if (f.kind === 'text' && f.required) {
            setError(`${f.label} is required`);
            setSaving(false);
            return;
          }
          payload[f.name] = null;
        } else {
          payload[f.name] = s;
        }
      }
    }

    if (onBeforeSubmit) payload = onBeforeSubmit(payload);

    const url = mode === 'create' ? endpoint : `${endpoint}/${id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
      setError(errorBody.error || `Save failed (${res.status})`);
      setSaving(false);
      return;
    }

    router.push(successHref);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
      {fields.map((f, i) => {
        if ('sectionTitle' in f) {
          return (
            <h2
              key={`section-${i}`}
              style={{
                fontFamily: 'var(--font-family-heading)',
                fontSize: 'var(--heading-tiny)',
                color: 'var(--text-primary)',
                margin: 'var(--gap-lg) 0 0',
                paddingTop: 'var(--padding-md)',
                borderTop: 'var(--border-width-md) solid var(--border-primary)',
              }}
            >
              {f.sectionTitle}
            </h2>
          );
        }

        if (f.kind === 'text') {
          return (
            <TextInput
              key={f.name}
              label={f.label}
              value={String(values[f.name] ?? '')}
              onChange={(e) => setValue(f.name, e.target.value)}
              placeholder={f.placeholder}
              required={f.required}
              fullWidth
            />
          );
        }
        if (f.kind === 'textarea') {
          return (
            <TextArea
              key={f.name}
              label={f.label}
              value={String(values[f.name] ?? '')}
              onChange={(e) => setValue(f.name, e.target.value)}
              rows={f.rows ?? 4}
              fullWidth
            />
          );
        }
        if (f.kind === 'number') {
          return (
            <TextInput
              key={f.name}
              label={f.label}
              type="number"
              value={String(values[f.name] ?? '')}
              onChange={(e) => setValue(f.name, e.target.value)}
              fullWidth
            />
          );
        }
        if (f.kind === 'switch') {
          return (
            <Switch
              key={f.name}
              label={f.label}
              checked={Boolean(values[f.name])}
              onChange={(e) => setValue(f.name, e.target.checked)}
            />
          );
        }
        if (f.kind === 'select') {
          return (
            <Select
              key={f.name}
              label={f.label}
              options={f.options}
              value={String(values[f.name] ?? '')}
              onChange={(e) => setValue(f.name, e.target.value)}
              placeholder={f.placeholder ?? 'Select…'}
              required={f.required}
            />
          );
        }
        return null;
      })}

      {error && (
        <p
          style={{
            fontFamily: 'var(--font-family-body)',
            fontSize: 'var(--body-sm)',
            color: 'var(--text-negative)',
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--gap-md)', marginTop: 'var(--gap-md)' }}>
        <Button type="submit" variant="primary" size="md" loading={saving}>
          {mode === 'create' ? 'Create' : 'Save changes'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => router.push(successHref)}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

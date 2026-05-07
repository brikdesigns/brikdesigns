'use client';

import { useState, useRef, type ChangeEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TextInput } from '@bds/components/ui/TextInput/TextInput';
import { Button } from '@bds/components/ui/Button/Button';

const BUCKET = 'marketing-media';

export interface MediaPickerProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /**
   * Optional folder prefix inside the bucket — e.g. `service-lines/brand-design`.
   * Helps keep the bucket organized when many entities upload media.
   * Falls back to `uploads/` when omitted.
   */
  pathPrefix?: string;
  /** File input `accept` attribute. Default: `image/*`. */
  accept?: string;
}

export function MediaPicker({
  label,
  value,
  onChange,
  pathPrefix,
  accept = 'image/*',
}: MediaPickerProps) {
  const [mode, setMode] = useState<'paste' | 'upload'>('paste');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);

    const supabase = createClient();
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const folder = pathPrefix?.replace(/^\/+|\/+$/g, '') || 'uploads';
    const path = `${folder}/${ts}-${safeName}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (upErr) {
      setError(upErr.message);
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
        <span
          style={{
            fontFamily: 'var(--font-family-label)',
            fontSize: 'var(--label-md)',
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {mode === 'paste' && (
        <TextInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or /uploads/…"
          fullWidth
        />
      )}

      {mode === 'upload' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            onChange={handleFile}
            disabled={uploading}
            style={{
              fontFamily: 'var(--font-family-body)',
              fontSize: 'var(--body-sm)',
              color: 'var(--text-secondary)',
            }}
          />
          {uploading && (
            <span
              style={{
                fontFamily: 'var(--font-family-body)',
                fontSize: 'var(--body-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              Uploading…
            </span>
          )}
        </div>
      )}

      {error && (
        <p
          style={{
            fontFamily: 'var(--font-family-body)',
            fontSize: 'var(--body-sm)',
            color: 'var(--text-negative)',
            margin: 0,
          }}
        >
          Upload failed: {error}
        </p>
      )}

      {value && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--gap-md)',
            padding: 'var(--padding-sm)',
            backgroundColor: 'var(--surface-secondary)',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="preview"
            style={{
              width: '64px',
              height: '64px',
              objectFit: 'cover',
              borderRadius: 'var(--border-radius-sm)',
              flexShrink: 0,
              backgroundColor: 'var(--surface-primary)',
            }}
          />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--gap-xs)' }}>
            <code
              style={{
                fontFamily: 'var(--font-family-system)',
                fontSize: 'var(--body-xs)',
                color: 'var(--text-secondary)',
                wordBreak: 'break-all',
              }}
            >
              {value}
            </code>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: 'paste' | 'upload';
  onChange: (m: 'paste' | 'upload') => void;
}) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 'var(--gap-xs)' }}>
      {(['paste', 'upload'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => onChange(m)}
          style={{
            fontFamily: 'var(--font-family-label)',
            fontSize: 'var(--label-sm)',
            padding: 'var(--padding-xs) var(--padding-sm)',
            backgroundColor: mode === m ? 'var(--surface-secondary)' : 'transparent',
            color: mode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'var(--border-width-md) solid var(--border-primary)',
            borderRadius: 'var(--border-radius-sm)',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

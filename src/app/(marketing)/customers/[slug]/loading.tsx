import { color } from '@/lib/tokens';

const bg = color.background.secondary;

export default function Loading() {
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: color.background.primary }}>
      <div style={{ height: '480px', backgroundColor: bg }} />
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '3rem 1.5rem',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: '1rem',
        }}
      >
        <div style={{ height: '2rem', backgroundColor: bg, borderRadius: '4px', width: '50%' }} />
        <div style={{ height: '1rem', backgroundColor: bg, borderRadius: '4px' }} />
        <div style={{ height: '1rem', backgroundColor: bg, borderRadius: '4px', width: '65%' }} />
      </div>
    </div>
  );
}

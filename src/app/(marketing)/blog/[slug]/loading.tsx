import { color } from '@/lib/tokens';

const bg = color.background.secondary;

export default function Loading() {
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: color.background.primary }}>
      <div style={{ height: '320px', backgroundColor: bg }} />
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '3rem 1.5rem',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: '1rem',
        }}
      >
        <div style={{ height: '2.5rem', backgroundColor: bg, borderRadius: '4px', width: '80%' }} />
        <div style={{ height: '1rem', backgroundColor: bg, borderRadius: '4px', width: '40%' }} />
        <div style={{ height: '1rem', backgroundColor: bg, borderRadius: '4px' }} />
        <div style={{ height: '1rem', backgroundColor: bg, borderRadius: '4px' }} />
        <div style={{ height: '1rem', backgroundColor: bg, borderRadius: '4px', width: '75%' }} />
      </div>
    </div>
  );
}

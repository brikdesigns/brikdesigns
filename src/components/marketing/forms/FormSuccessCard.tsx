import { heading, text } from '@/lib/styles';
import { border, color, gap, space } from '@/lib/tokens';

export function FormSuccessCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: space.xl,
        backgroundColor: color.surface.success,
        borderRadius: border.radius.lg,
        textAlign: 'center',
      }}
    >
      <h2 style={{ ...heading.md, color: color.text.success }}>{title}</h2>
      <p style={{ ...text.body, color: color.text.secondary, marginTop: gap.sm }}>
        {body}
      </p>
    </div>
  );
}

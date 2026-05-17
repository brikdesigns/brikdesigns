import { Card, CardTitle, CardDescription } from '@brikdesigns/bds';
import { color } from '@/lib/tokens';

export function FormSuccessCard({ title, body }: { title: string; body: string }) {
  return (
    <Card variant="elevated" style={{ backgroundColor: color.surface.success, textAlign: 'center' }}>
      <CardTitle style={{ color: color.text.success }}>{title}</CardTitle>
      <CardDescription>{body}</CardDescription>
    </Card>
  );
}

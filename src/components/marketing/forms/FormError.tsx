import { text } from '@/lib/styles';
import { color } from '@/lib/tokens';

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p style={{ ...text.bodySm, color: color.text.negative, margin: 0 }}>
      {message}
    </p>
  );
}

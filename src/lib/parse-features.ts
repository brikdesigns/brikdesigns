// Split an operator-authored "what you get" block (one item per line) into
// individual feature strings. Strips bullet glyphs, numeric markers, and
// leading/trailing whitespace so operators can paste from Google Docs / Notion
// without formatting leaking through.
export function parseFeatures(text: string | null | undefined): string[] | undefined {
  if (!text) return undefined;
  const items = text
    .split('\n')
    .map((line) =>
      line.replace(/^\s*(?:[•\-–—*>✓✗◦]|\d+[.)])\s*/, '').trim()
    )
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

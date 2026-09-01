// Inline check glyph for the HIW process-card checklists (#1121, #1123).
// App-local and self-contained — the process card lives outside BDS, and an
// inline SVG never waits on the Iconify offline subset (a ph:* glyph not yet
// bundled falls through to a CDN fetch, flashing an empty box on first paint).
export function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M4.5 10.5l3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

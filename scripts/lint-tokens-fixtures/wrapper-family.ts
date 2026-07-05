// Fixture: typed-token-wrapper family drift (Rule 6 / checkWrapperFamily).
// Expected violations: 3.
//
// Mirrors the shape of src/lib/tokens.ts so the wrapper-definition rule has a
// faithful target. Three intentional violations + matching pass/escape-hatch
// cases prove the rule fires on the real failure modes and only those.
//
// NOTE: lives under scripts/ (excluded from tsconfig) so it is never type-
// checked or scanned by the live `src/**` lint glob — the test drives it
// directly via checkWrapperFamily(readFixture(...), 'wrapper-family.ts').

const color = {
  surface: {
    primary: 'var(--surface-primary)', // pass — surface key, surface value
    // VIOLATION 1 — surface namespace holding a --background-* token (the
    // BACKLOG-318 / #528 surface.tertiary shape).
    tertiary: 'var(--background-tertiary)',
  },
  background: {
    primary: 'var(--background-primary)', // pass — background key, background value
    // VIOLATION 2 — background namespace holding a --surface-* token (reverse).
    odd: 'var(--surface-secondary)',
  },
  service: {
    brand: {
      bg: 'var(--background-service-brand)', // pass — bg key, background value
      surface: 'var(--surface-service-brand)', // pass — surface key, surface value
      surfaceDark: 'var(--surface-service-brand-dark)', // pass
      text: 'var(--text-service-brand-on-light)', // pass — text key, text value
      inverse: 'var(--surface-service-brand-inverse)', // pass — inverse is surface-only (ADR-012)
      // VIOLATION 3 — the BACKLOG-318 surface↔background drift shape: a
      // background-context key (`onLight`) aliasing a `--surface-*` token.
      onLight: 'var(--surface-service-brand-dark)',
      // escape-hatch — same violation shape as #3 but explicitly suppressed.
      onDark: 'var(--surface-service-brand-dark)', /* bds-lint-ignore token-family — fixture: proves the pragma suppresses */
    },
  },
} as const;

export { color };

#!/usr/bin/env node
// Schema/form parity check.
//
// Verifies that three sources of truth agree for each entity brikdesigns
// admin writes to:
//
//   1. supabase Row interface   — src/types/supabase.ts (DB-authoritative)
//   2. write-side SCHEMA        — src/lib/admin/<entity>.ts (validation)
//   3. admin field-configs      — src/app/(admin)/admin/services/_components/field-configs.ts (UI)
//
// SCHEMA keys MUST be a subset of Row keys; field-config names MUST be a
// subset of SCHEMA keys. A violation means a column was dropped, renamed, or
// added without propagating — the kind of drift that masked our 2026-05-11
// "price columns under our nose" incident.
//
// Usage: npm run check:schema

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TYPES = path.join(ROOT, 'src/types/supabase.ts');
const ENTITIES = [
  {
    table: 'service_lines',
    schemaFile: 'src/lib/admin/service-lines.ts',
    configFn: 'serviceLineFields',
  },
  {
    table: 'services',
    schemaFile: 'src/lib/admin/services.ts',
    configFn: 'serviceFields',
  },
  {
    table: 'offerings',
    schemaFile: 'src/lib/admin/offerings.ts',
    configFn: 'offeringFields',
  },
];
const CONFIGS = path.join(ROOT, 'src/app/(admin)/admin/services/_components/field-configs.ts');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

// Extract column names from a single Row: { ... } block inside the
// generated supabase types. Returns null if the table isn't present.
function rowColumnsFor(typesText, tableName) {
  // Match `tableName: {\n        Row: {\n          ...keys...\n        }`
  const re = new RegExp(
    `\\b${tableName}: \\{\\s*Row: \\{([^}]*)\\}`,
    'm'
  );
  const m = typesText.match(re);
  if (!m) return null;
  const block = m[1];
  const cols = [];
  for (const line of block.split('\n')) {
    const km = line.match(/^\s*([a-z_][a-z0-9_]*)\s*:/i);
    if (km) cols.push(km[1]);
  }
  return new Set(cols);
}

// SCHEMA: FieldSchema = { name: 'kind', ... } — extract the keys.
// ASSUMPTION: each entry is `key: 'string-literal-kind'` on one line. A
// multi-line value (nested object, conditional, etc.) would truncate this
// block early; we'd then under-count keys and flag false orphans. If we ever
// move to richer SCHEMA shapes, replace the regex parse with a TS-AST walk.
function schemaKeysFor(file) {
  const text = read(file);
  const m = text.match(/const SCHEMA[^=]*=\s*\{([\s\S]*?)\n\}/);
  if (!m) return null;
  const keys = new Set();
  for (const line of m[1].split('\n')) {
    const km = line.match(/^\s*([a-z_][a-z0-9_]*)\s*:\s*['"]/);
    if (km) keys.add(km[1]);
  }
  return keys;
}

// Inside a `function <fnName>(...): FieldOrSection[] { return [ ... ]; }`,
// pull out each `name: 'X'` literal. Boundary = the next column-0 `}` (the
// function close). Requires field-configs.ts to keep functions module-level
// with closing braces at column 0; throws if no close is found so a future
// EOF-trailing function can't silently widen the matched body.
function configFieldNamesFor(text, fnName) {
  const start = text.indexOf(`function ${fnName}(`);
  if (start === -1) return null;
  const after = text.slice(start);
  const endRel = after.search(/\n\}/);
  if (endRel === -1) {
    throw new Error(
      `Could not find closing brace for function ${fnName}() — ` +
      `field-configs.ts may be malformed`
    );
  }
  const body = after.slice(0, endRel);
  const names = new Set();
  for (const m of body.matchAll(/\bname:\s*['"]([a-z_][a-z0-9_]*)['"]/gi)) {
    names.add(m[1]);
  }
  return names;
}

const typesText = read(TYPES);
const configsText = read(CONFIGS);

const failures = [];
const rows = [];

for (const { table, schemaFile, configFn } of ENTITIES) {
  const dbCols = rowColumnsFor(typesText, table);
  const schemaKeys = schemaKeysFor(path.join(ROOT, schemaFile));
  const configNames = configFieldNamesFor(configsText, configFn);

  if (!dbCols) {
    failures.push(`${table}: not found in src/types/supabase.ts (run \`npm run gen:types\`?)`);
    continue;
  }
  if (!schemaKeys) {
    failures.push(`${table}: SCHEMA not parseable in ${schemaFile}`);
    continue;
  }
  if (!configNames) {
    failures.push(`${table}: function ${configFn}() not found in field-configs.ts`);
    continue;
  }

  const schemaOrphans = [...schemaKeys].filter((k) => !dbCols.has(k));
  const configOrphans = [...configNames].filter((n) => !schemaKeys.has(n));

  rows.push({
    table,
    dbCols: dbCols.size,
    schemaKeys: schemaKeys.size,
    configNames: configNames.size,
    schemaOrphans,
    configOrphans,
  });

  for (const k of schemaOrphans) {
    failures.push(
      `${table}: SCHEMA key '${k}' is not a column in DB Row (${schemaFile})`
    );
  }
  for (const n of configOrphans) {
    failures.push(
      `${table}: field-config '${n}' (${configFn}) is not in SCHEMA — writes will be dropped`
    );
  }
}

console.log('Entity         DB cols  SCHEMA  Form fields  Schema orphans  Config orphans');
console.log('────────────  ────────  ──────  ───────────  ──────────────  ──────────────');
for (const r of rows) {
  console.log(
    `${r.table.padEnd(13)}${String(r.dbCols).padStart(9)}${String(r.schemaKeys).padStart(8)}${String(r.configNames).padStart(13)}${String(r.schemaOrphans.length).padStart(16)}${String(r.configOrphans.length).padStart(16)}`
  );
}

if (failures.length === 0) {
  console.log('\nOK — schema, SCHEMA, and field-configs agree.');
  process.exit(0);
}

console.error('\nFAIL — parity violations:\n');
for (const f of failures) console.error(`  ${f}`);
process.exit(1);

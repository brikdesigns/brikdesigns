/**
 * Shared input filtering for admin write operations.
 *
 * Each marketing entity exposes a strict allowlist of fields that the admin UI
 * (and external agents) are permitted to write. Unknown fields are dropped
 * rather than failing — this keeps the API forward-compatible while preventing
 * agents from accidentally writing portal-owned fields like `stripe_product_id`,
 * `stripe_price_id`, `proposal_copy`, or `contract_copy`.
 *
 * Note: `base_price_cents` and `billing_frequency` ARE writable here per
 * 2026-05-11 decision (marketers need to edit prices). Stripe identifiers
 * stay portal-only — those are the actual source-of-truth for billing.
 *
 * Validation is intentionally narrow: type shape only. Slug format, FK
 * existence, and uniqueness are enforced by Postgres (UNIQUE constraints +
 * REFERENCES) so the database error surfaces directly to the caller.
 */

export type FieldType = 'string' | 'string-or-null' | 'number' | 'number-or-null' | 'boolean' | 'uuid';

export type FieldSchema = Record<string, FieldType>;

export class AdminInputError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'AdminInputError';
  }
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function pickAndValidate(
  input: unknown,
  schema: FieldSchema,
  options: { required?: readonly string[] } = {},
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AdminInputError('Body must be a JSON object');
  }

  const raw = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, type] of Object.entries(schema)) {
    if (!(key in raw)) continue;
    const value = raw[key];

    switch (type) {
      case 'string':
        if (typeof value !== 'string') throw new AdminInputError(`${key} must be a string`);
        out[key] = value;
        break;
      case 'string-or-null':
        if (value !== null && typeof value !== 'string') {
          throw new AdminInputError(`${key} must be a string or null`);
        }
        out[key] = value;
        break;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new AdminInputError(`${key} must be a finite number`);
        }
        out[key] = value;
        break;
      case 'number-or-null':
        if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
          throw new AdminInputError(`${key} must be a finite number or null`);
        }
        out[key] = value;
        break;
      case 'boolean':
        if (typeof value !== 'boolean') throw new AdminInputError(`${key} must be a boolean`);
        out[key] = value;
        break;
      case 'uuid':
        if (!isUuid(value)) throw new AdminInputError(`${key} must be a UUID`);
        out[key] = value;
        break;
    }
  }

  for (const key of options.required ?? []) {
    if (out[key] === undefined) {
      throw new AdminInputError(`${key} is required`);
    }
  }

  return out;
}

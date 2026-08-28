/**
 * Unit smoke test for the GHL RSVP webhook payload mapper (#886).
 * Pure-function coverage only — no network, no secret. Run:
 *   npx tsx scripts/test-ghl-webhook.ts
 */
import { buildRsvpNotification } from '@/app/api/webhooks/ghl/route';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}`);
    failures++;
  }
}

// 1. Full RSVP payload maps every field and routes to #events.
const full = buildRsvpNotification({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '901-555-0100',
  grad_year: '2025',
  staying_in_tn: 'Yes',
});
check('full payload → non-null', full !== null);
check('name mapped', full?.name === 'Ada Lovelace');
check('email mapped', full?.email === 'ada@example.com');
check('phone mapped', full?.phone === '901-555-0100');
check('eventTitle routes to #events', full?.eventTitle === 'Grind After Graduation');
check('source tagged', full?.source === 'ghl-webhook');
check('company_name defaulted', full?.company_name === 'N/A (event RSVP)');
check('grad year in message', !!full?.message?.includes('Graduation year: 2025'));
check('TN answer in message', !!full?.message?.includes('Staying in Tennessee: Yes'));

// 2. Missing email → null (route acks 200 skipped).
check('no email → null', buildRsvpNotification({ name: 'No Email' }) === null);
// 3. Missing name → null.
check('no name → null', buildRsvpNotification({ email: 'x@y.com' }) === null);
// 4. Blank/whitespace values are treated as absent.
check('whitespace name → null', buildRsvpNotification({ name: '   ', email: 'x@y.com' }) === null);
// 5. No extras → no message.
check('no extras → undefined message', buildRsvpNotification({ name: 'A', email: 'a@b.com' })?.message === undefined);

if (failures > 0) {
  console.error(`\n✗ ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('\n✓ ghl-webhook mapper: all assertions passed');

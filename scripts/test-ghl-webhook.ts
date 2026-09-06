/**
 * Unit smoke test for the GHL RSVP webhook payload mapper (#886).
 * Pure-function coverage only — no network, no secret. Run:
 *   npx tsx scripts/test-ghl-webhook.ts
 */
import { buildRsvpNotification, buildRsvpRegistration } from '@/app/api/webhooks/ghl/route';

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

// ── buildRsvpRegistration (#1024) ──
const EVT = 'd5ba06ac-4399-4c77-9ae6-b25560b506e2';

// 6. Full payload → event_registrations row.
const reg = buildRsvpRegistration(
  { name: 'Ada Lovelace', email: 'ada@example.com', phone: '901-555-0100', company_name: 'Byron Dental', grad_year: '2025', staying_in_tn: 'Yes' },
  EVT,
);
check('registration → non-null', reg !== null);
check('registration event_id', reg?.event_id === EVT);
check('registration first_name split', reg?.first_name === 'Ada');
check('registration last_name split', reg?.last_name === 'Lovelace');
check('registration email', reg?.email === 'ada@example.com');
check('registration phone', reg?.phone === '901-555-0100');
check('registration practice_name from company', reg?.practice_name === 'Byron Dental');
check('registration source tagged', reg?.source === 'ghl-webhook');
check('registration status registered', reg?.status === 'registered');
check('registration notes carry grad year', !!reg?.notes?.includes('Graduation year: 2025'));
check('registration notes carry TN', !!reg?.notes?.includes('Staying in Tennessee: Yes'));

// 7. Single-word name → last_name null.
check('single-word name → last_name null', buildRsvpRegistration({ name: 'Cher', email: 'c@x.com' }, EVT)?.last_name === null);
// 8. No company → practice_name null (unlike the notification's 'N/A' default).
check('no company → practice_name null', buildRsvpRegistration({ name: 'A B', email: 'a@b.com' }, EVT)?.practice_name === null);
// 9. No extras → notes null.
check('no extras → notes null', buildRsvpRegistration({ name: 'A B', email: 'a@b.com' }, EVT)?.notes === null);
// 10. Missing name/email → null (route skips the insert).
check('registration no email → null', buildRsvpRegistration({ name: 'No Email' }, EVT) === null);
check('registration no name → null', buildRsvpRegistration({ email: 'x@y.com' }, EVT) === null);

if (failures > 0) {
  console.error(`\n✗ ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('\n✓ ghl-webhook mapper: all assertions passed');

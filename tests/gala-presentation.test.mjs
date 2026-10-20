import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentsCsv } from '../lib/gala/assignments.ts';
import { giftsCsv } from '../lib/gala/gift-fulfillment.ts';
import { invitationsCsv } from '../lib/gala/invitations.ts';
import { invitationLabelsHtml } from '../lib/gala/invitation-print.ts';
import { galaExportFilename } from '../lib/gala/presentation.ts';

const contact = { name: 'Fictional Buyer', email: 'fixture@example.com', phone: '4325550100' };
const recipient = { name: 'Guest <One>', address: '123 Fixture Lane', address2: '', city: 'Odessa', state: 'TX', zip: '01234' };
const invitation = { request_id: '00000000-0000-4000-8000-000000000001', recipient_index: 0, recipient, contact, status: 'requested', revision: 0 };

test('live fulfillment exports retain the same data and CSV protections without development labeling', () => {
  const builders = [
    live => assignmentsCsv([{ id: invitation.request_id, tier: 'gold', table_number: 7, buyer: contact, seats: 8, extra_seats: 0 }], live),
    live => giftsCsv([{ order_id: invitation.request_id, recipient_index: 0, buyer: contact, student: '=Fixture', grade: '9', roses: 2, cookies: 1, status: 'prepared' }], live),
    live => invitationsCsv([invitation], new Set(), live),
  ];
  for (const build of builders) {
    const sandbox = build(false), live = build(true);
    assert.match(sandbox, /DEVELOPMENT ONLY/);
    assert.equal(live, sandbox.replaceAll('DEVELOPMENT ONLY', 'GALA 2027'));
    assert.match(live, /fixture@example.com/);
  }
  for (const kind of ['gifts', 'invitations', 'table-assignments']) {
    assert.equal(galaExportFilename(kind, true), `gala-2027-${kind}.csv`);
    assert.equal(galaExportFilename(kind, false), `gala-2027-development-${kind}.csv`);
  }
});

test('live mailing labels remove only test markings, preserving fit checks, escaping and truthful mailing instructions', () => {
  const sandbox = invitationLabelsHtml([invitation], 'requested', 1);
  const live = invitationLabelsHtml([invitation], 'requested', 1, true);
  assert.match(sandbox, /DEVELOPMENT ONLY — FICTIONAL ADDRESS/);
  assert.doesNotMatch(live, /DEVELOPMENT ONLY|FICTIONAL ADDRESS|Development invitation labels/);
  for (const html of [sandbox, live]) {
    assert.match(html, /Guest &lt;One&gt;/);
    assert.match(html, /01234/);
    assert.match(html, /Used label — left blank/);
    assert.match(html, /Printing does not mark invitations prepared or mailed/);
    assert.match(html, /validateLabels/);
    assert.doesNotMatch(html, /fixture@example.com/);
  }
  assert.throws(() => invitationLabelsHtml([{ ...invitation, status: 'mailed' }], 'requested', 0, true), /No invitations/);
  assert.throws(() => invitationLabelsHtml([invitation, { ...invitation, recipient_index: 1 }], 'requested', 0, true), /Review possible duplicates/);
});

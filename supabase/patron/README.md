# Patron registration and recognition

The public form at `/patron` and the shared-password admin at `/admin/patron`
use one current-year roster. Online signups require a name, email, and explicit
permission to display the name. Phone is optional. Check entries require only a
name. Online signups wait in **Needs review**; administrators can **Save
corrections** without publishing, then **Approve and publish** the corrected name.
Approved names can be hidden or restored. Manually entered check patrons can
be published by the administrator entering them.
Only names are returned for public rendering. The 2025 list is historical and
remains separate from current registrations.

The public website offers **$100 one-time Patron dues through Stripe only**.
Invitations provide check-payment instructions; the private admin still records
checks. The old contact-only `/api/patron` submission returns HTTP 410 so a stale
form cannot submit the retired check option. When card checkout is paused, the
page shows an unavailable message instead of a contact-only signup form.
An online signup is not proof of payment. No
QuickBooks entry or application email is sent.

## Patron card payments — live October 20, 2026

Autofill repair: application `429c5ba` is live as
`dpl_8dmgSmQXCJmy49rEx5pGPHa9NKdQ`, with immutable host
`odessasymphonyguild-ipusu1ss6-boonewhs-projects.vercel.app`. The old off-screen
`company` trap caused false rejection when autofilled. Its replacement is fully
hidden with a neutral `patron_guard` name and autocomplete disabled; legacy
company values are accepted but discarded. Twenty-one Patron tests and the build
pass. Twenty-eight hosted checks verified that a filled replacement trap fails
before payment creation while legacy autofill and the new form share one live
$100 checkout. That fictional checkout was expired unpaid, automatically
reconciled, and removed with its private test patron. No card was charged. The
production DOM confirms the new input has no rendered rectangles and the former
company input is gone. Name approval, closed Gala submissions and hidden public
navigation remain unchanged. Private evidence uses `patron-autofill-*`.

Stripe-only website follow-up: application `e6ed1d8` is live as
`dpl_GTkHbX3Cy4LJTbQpQ4o6eqf4tKvc`, with immutable host
`odessasymphonyguild-lqwhb034g-boonewhs-projects.vercel.app`. Public check-payment
directions/options are removed, including the privacy-policy wording, and the
retired contact-only endpoint returns HTTP 410. Manual check admin remains.
Twenty Patron tests, the build, 12 live HTTP checks and a visual production review
pass. Both Gala submission flags remain false, navigation remains hidden, and
payment recovery continues successfully. No database or environment changes and
no payment were needed for this follow-up.

The user explicitly authorized the payment migration, production deployment and
Patron card activation while keeping Gala closed and public Patron navigation
hidden. Migration `003_payments.sql` is installed in the existing production
database; **do not rerun it**. Production-only `PATRON_STRIPE_ENABLED=true` and
`PATRON_CARD_PAYMENTS_OPEN=true` are enabled alongside `PATRON_ENABLED=true`.
Application commit `31ff961` is deployed as
`dpl_2Ma1wcac68DC3QF5jWqp9oWGVms1`, Ready and aliased to
https://www.odessasymphonyguild.org. Its immutable host is
`odessasymphonyguild-jnypa7qie-boonewhs-projects.vercel.app`. The upload used a clean
Git archive; no main merge, Preview change, credential upload or local test-data
copy was performed.

Production acceptance passed 27 hosted HTTP checks, including the $100 USD live
Checkout creation/retry, protected status, admin correction without publication,
refusal to overwrite pending card payment with a check, shared admin/Dues access
to all 120 students, rejected forged inputs and closed Gala submissions. The
verification checkout was expired **unpaid** without entering a card. Actual
Stripe `checkout.session.expired` delivery returned HTTP 200 and changed the
private roster to card-expired without a buyer return or name approval. Stripe
reported zero pending webhooks. Invalid signatures returned HTTP 400. Three
automatic recovery calls returned HTTP 200 with Patron processing included.
The payment table/functions deny browser roles and allow the service role.

The exact fictional verification patron and expired payment row were removed
after delivery. Final membership records and existing membership/Gala
schema/grants match the pre-migration fingerprints; no verification patrons or
payment rows remain. Both Gala submission flags are false. The live page was
visually checked: card/check choices are present, review is required, and no
PATRONS header link is shown. No live charge, refund or payout was made; successful
charged-payment coverage is from the prior sandbox test, not a production charge.
Private evidence uses `patron-payment-*` / `patron-payments-*` under
`.codex-remote-attachments/live-setup/`.

`003_payments.sql` adds a private payment ledger and dues status to the existing
roster. It preserves approval: a successful payment updates only payment status,
never the displayed name, contact corrections, or publication. The admin shows
card pending/paid/expired and recorded checks separately from name approval.
For online signups paying by check, review the entry and select **We have received
this patron’s $100 check payment**. A pending or paid card checkout cannot be
overwritten with a check. Manual check entries are recorded as checks on entry.

The integration reuses the existing Gala Stripe credentials, pinned account,
four Checkout webhook events at `/api/gala/webhook`, and scheduled recovery at
`/api/gala/recovery/run`. Patron metadata and ledger records are separate from
Gala orders. No new Stripe key, webhook endpoint, or recurring subscription is
needed. Gala sales and invitations remain closed. Public Patron navigation
remains hidden; restore it only when requested, using PATRONS/Patrons.

Production release procedure (completed above; retained for operational reference):

1. Capture the existing membership/Gala data and schema/grant baseline. Apply
   **only `003_payments.sql` once** to the existing production database; 001 and
   002 are already installed. Verify the baseline is unchanged. Do not copy
   local fictional records to production.
2. Keep existing live configuration and set Production-only
   `PATRON_STRIPE_ENABLED=true` and `PATRON_CARD_PAYMENTS_OPEN=false`. Deploy this
   compatible feature branch. The first flag enables webhook/status/recovery;
   the second controls creation/resumption of hosted checkout through the site.
3. Verify hosted admin, service-role RPCs, denied browser-role ledger access,
   shared Dues/Gala access, invalid webhook signature rejection and scheduled
   recovery. Keep both Gala submission flags false.
4. Once live Patron card payments are authorized, set
   `PATRON_CARD_PAYMENTS_OPEN=true` and redeploy. Verify the $100 USD checkout,
   actual Stripe delivery and independent name approval. Any real-money test
   payment requires the user's authorization; sandbox evidence is not a claim
   of verified production payment delivery.

To pause new card checkouts, set only `PATRON_CARD_PAYMENTS_OPEN=false` and
redeploy. Keep `PATRON_ENABLED`, `PATRON_STRIPE_ENABLED`, and the shared Gala
processing enabled so existing payments can settle. Already issued Stripe links
may remain payable until they expire; the application pause does not revoke them.
Preserve all payment tables/functions on rollback and deploy a compatible
release. Never deploy old main.

Checkout price, currency and year are pinned on the server. Retries reuse a
stable Stripe idempotency key and immutable session parameters. Same-contact
active attempts cannot create a second payment through a different request ID.
The return page requires the random access token kept in the original browser
tab; URLs expose no contacts or token. A verified Stripe session and PaymentIntent
are required before recording paid status. Only verified unpaid expiration
permits a new attempt. Replayed expiration events cannot replace a later payment
or check status. Recovery checks pending attempts even when the buyer never
returns, including searching for a session whose creation response was lost.

If an attempt has no recoverable Stripe session, it remains pending for review
rather than risk a second charge. Check the private `patron_payments` row by ID
and search Stripe by `patron_payment_id` metadata. Do not manually reset it or
tell the patron to pay again without resolving the original attempt. The shared
recovery response reports `needs_review` or `retry_required` for unresolved rows;
an unavailable Patron store reports `patronRecovery: retry_required` while Gala
recovery still runs. Browser users should use the existing Contact section.

Sandbox acceptance: a real hosted Stripe sandbox checkout charged the test card
$100 and delivered `checkout.session.completed` with HTTP 200. The return page
confirmed payment; admin displayed **$100 paid by card / Needs review**, with no
public name. A second actual sandbox session was expired and confirmed unpaid.
The admin recorded its later fictional check while keeping the name private.
Private sandbox IDs/evidence are under `.codex-remote-attachments/live-setup/`.
That sandbox rehearsal made no live charge or production migration; the later
authorized production installation and acceptance are recorded above.

Validation: 20 Patron tests and all 177 Gala regression tests pass, including
access controls, duplicate/lost responses, verified settlement, approval
isolation, expiration replay and the hosted adapter contract. The production
build and its TypeScript check pass. Desktop admin and mobile signup layouts
were reviewed. Existing Next middleware/Edge and metadataBase warnings remain.

Implementation references: [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests)
and [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment).

## Local development

- Run `npm run dev` with the existing local shared-admin configuration.
- Use the hostname in `GALA_LOCAL_ORIGIN` (currently `http://localhost:3000`),
  including for sign-in; mutations require that exact origin.
- Patron records persist in `.patron-data.local/`, ignored by Git. This local
  PGlite database never uses the membership database or hosted Gala test data.
- The existing shared-admin login still uses its configured test service for
  login throttling. Normal network access is needed for that sign-in.
- `PATRON_ENABLED=false` closes local Patron registration/admin. The public page
  remains available with historical recognition and a contact link.
- Use fictional names/contact details for local testing.
- Run `npm run test:patron`, `npx tsc --noEmit`, and `npm run build`.
- Card payments default on locally with the existing sandbox credentials. Run
  `npm run gala:listen` to forward sandbox Checkout events. Local PGlite applies
  the payment migration on first use; all test data remains local.

## Production rollout

The user authorized Patron installation and production deployment on October 20,
2026, with Gala sales kept closed. The Patron-only installer has been applied to
`uhfxkdzhpyzuwkvmners`; before/after fingerprints confirm unchanged membership
records and existing membership/Gala schema, grants and default privileges.
`PATRON_ENABLED=true` is scoped to Vercel Production only. Deployment acceptance
is recorded below. Do not rerun either one-time installer, merge
old main over the live release, or open Gala sales/invitation flags.

1. For a fresh database apply `001_patrons.sql`, then `002_approval.sql`, each
   **once**. For an existing installation apply only `002_approval.sql` before
   deploying the approval UI. It returns existing online entries to review,
   preserves contacts/check entries, and records approvals with `approved_at`.
   It adds only `public.patron_*` objects and targeted grants. It does not change
   shared default privileges, Dues records, or Gala objects. Anonymous and
   authenticated Supabase clients have no table or function access.
2. Keep the existing live shared-admin/Gala configuration and webhook/recovery
   processing. Patron uses that server-side database connection and shared login.
   Set `PATRON_ENABLED=true` only for the authorized production deployment.
3. Deploy the feature branch containing the current live Gala processing.
   Previews do not enable Patron or use the local database.
4. Verify public signup, admin check entry, editing/hiding, contact privacy,
   duplicate handling, and shared Dues/Gala access on the deployed host. Do not
   copy the local test roster to production.

Server-side validation, a 2 KiB request limit, same-origin writes, a honeypot,
and a durable five-signup/15-minute limit protect the signup inbox. The
honeypot is a fully hidden `patron_guard` field with autocomplete disabled, not
an off-screen contact field. The former `company` field is accepted and ignored
for older open forms because browser autofill can populate company names.
Neither field is stored or sent to Stripe. A filled replacement trap is rejected
before creating a signup or contacting Stripe. The
limiter stores a keyed hash, not an IP address, and removes buckets older than a
day on subsequent submissions. It uses Vercel's supplied
[`x-vercel-forwarded-for` header](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for).
Public requests cannot set publication status, approval timestamps or source.
The database also forces every online insert to remain private, even if an older
server sends `published=true`. Approval requires a later authenticated admin
update. Browser database roles still have no direct access. Volunteers must
review names before approving; names can also be hidden afterward.

Retries use a request UUID. Matching name/email entries for the same year are
kept without overwriting contact details or changing public visibility. Check
entries without email are separate records; volunteers can search the roster
before adding one and hide a duplicate if necessary.

## Approval release — October 20, 2026

Navigation follow-up: commit `4234be9`, deployment
`dpl_GjSSNtZxdyHhrye5stmZEECViuf5`, hides the public header link on desktop and
mobile at the user's request. `SHOW_PATRONS_NAV=false` controls both; when
restored the label is PATRONS/Patrons. The page and admin remain available.
TypeScript checking and the hosted build pass; live homepage, Gala and Patron
headers were checked. Gala submissions remain closed and recovery is current.

The user reversed automatic publication and requested review/correction before
online names appear. Migration `002_approval.sql` is installed in production;
do not rerun it. There were no existing online records at migration time.
Application commit `f42c0fc` is deployed as
`dpl_3EvnhYjJhuiSYhyQGfgZ1oZ8dp2k`, aliased to the canonical live domain.
The immutable host is `odessasymphonyguild-4hou07z46-boonewhs-projects.vercel.app`.

Ten Patron tests, TypeScript checking and the production build pass. A browser
walkthrough confirmed Needs review filtering, saved corrections remaining
private, and explicit approval publishing the corrected name. Forty-two hosted
HTTP checks verified pending signups, rejected forged publication/source/approval
fields, denied unauthenticated approval, correction without publication,
approval, hiding, retry protection, check entries, contact privacy and shared
Dues access to all 120 records. Temporary verification entries were removed.
Existing membership data and membership/Gala schema/grants remain unchanged.
Both Gala submission flags remain false; webhook processing and automatic
recovery remain active. Private evidence uses the `patron-approval-*` prefix in
`.codex-remote-attachments/live-setup/`.

## Initial production acceptance — October 20, 2026

Initial application commit `85704eb` on `codex/patron-page-design` was deployed at
https://www.odessasymphonyguild.org/patron. The shared-password Patron admin is
https://www.odessasymphonyguild.org/admin/patron. Deployment
`dpl_CGxKc61sxDHSj3d6UnbxZrF1wriN` is Ready and aliased to the canonical domain;
its immutable host is `odessasymphonyguild-6eaa9n3h0-boonewhs-projects.vercel.app`.
The upload used a Git archive, excluding local credentials and test records.
No main merge or Preview configuration changes were made.

- Eight Patron tests, 177 Gala regression tests, three membership OAuth tests,
  TypeScript checking and the production build passed.
- 31 hosted HTTP checks passed: public signup, repeated-request protection,
  manual check entry, one shared roster, public-name rendering, private contact
  information, corrections, hiding/restoring, CSRF rejection and admin access.
- All 120 Dues records remain readable. Final membership record hashes and the
  existing membership/Gala schema, grants and default privileges match the
  pre-install baseline. Anonymous/authenticated database access to Patron tables
  and the write function is denied; both tables have RLS enabled.
- Both temporary verification patrons were hidden promptly and then removed by
  their exact UUIDs. The current-year production roster starts empty; historical
  2025 recognition remains. Local preview names were never copied.
- Gala checkout and invitation attempts remain rejected with closed flags.
  The existing four-event Stripe webhook remains enabled; invalid signatures
  are rejected and a signed harmless verification event returns HTTP 200.
  Three automatic recovery calls returned HTTP 200, with a fresh heartbeat.
  No charge, payout, invitation, or Gala order was created.
- The deployed signup form was visually reviewed. Existing shared passwords
  were unchanged; verification credentials were used only in memory.

Private non-Git evidence is in `.codex-remote-attachments/live-setup/` under
`patron-*` and `deployment-patron-85704eb.json`. Keep it out of Git.

Before card payments are activated, Patron registration/admin can be paused with
`PATRON_ENABLED=false` in Production and a compatible redeployment. After payment
activation, use the card-only pause described above and preserve processing.
After installing approval, preserve `002_approval.sql` and its trigger on any
application rollback. Old UI versions lack the review list; prefer fixing forward
or temporarily disabling Patron rather than restoring automatic publication.
Never deploy old main as a rollback: it lacks live Gala webhook/recovery.

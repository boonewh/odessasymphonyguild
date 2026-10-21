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

This is contact registration, not a payment workflow. No card charge, invoice,
QuickBooks entry, or email is sent. An online signup is not proof of payment.

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

To pause Patron registration/admin, set `PATRON_ENABLED=false` in Production
and redeploy the current compatible release; preserve the stored roster.
After installing approval, preserve `002_approval.sql` and its trigger on any
application rollback. Old UI versions lack the review list; prefer fixing forward
or temporarily disabling Patron rather than restoring automatic publication.
Never deploy old main as a rollback: it lacks live Gala webhook/recovery.

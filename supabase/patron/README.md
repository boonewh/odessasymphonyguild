# Patron registration and recognition

The public form at `/patron` and the shared-password admin at `/admin/patron`
use one current-year roster. Online signups require a name, email, and explicit
permission to display the name. Phone is optional. Check entries require only a
name. Administrators can correct contact details and hide or restore a name.
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
is recorded below when complete. Do not rerun either one-time installer, merge
old main over the live release, or open Gala sales/invitation flags.

1. Apply `001_patrons.sql` **once** to the approved production membership database.
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
and a durable five-signup/15-minute limit protect automatic publication. The
limiter stores a keyed hash, not an IP address, and removes buckets older than a
day on subsequent submissions. It uses Vercel's supplied
[`x-vercel-forwarded-for` header](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for).
Public names should still be checked by volunteers; names can be hidden in admin.

Retries use a request UUID. Matching name/email entries for the same year are
kept without overwriting contact details or changing public visibility. Check
entries without email are separate records; volunteers can search the roster
before adding one and hide a duplicate if necessary.

# Gala production database preparation

**Prepared locally only. Not applied to Supabase. Sales are not authorized to launch.**

`001_initial.sql` is a fresh-install package for a dedicated, empty Gala production project. It refuses an existing public schema, including the membership database and Gala development database. It is not an upgrade, copy or cleanup of the test database. Do not apply it until the target project is identified, the release is ready and the user authorizes the production application.

## What the installer contains

The existing, tested Gala schema sequence through migration 014 is packaged into **one transaction**, followed by production safeguards. Source filenames and normalized SHA-256 hashes appear inside the output. The packaging script has an explicit file allowlist; it never reads environment files or connects to providers. It changes the database marker to `osg-gala-production`, restricts payment binding/settlement to literal `cs_live_` identifiers, and records shared-admin changes as `shared-admin` rather than a named volunteer.

The committed result starts with:

- Zero orders, recipients, payment events, table assignments, staff accounts, accounting history or credentials.
- Three board-confirmed unlimited table tiers. Intermediate historical stock values are inside the same transaction and never published.
- New sales and invitation submissions **closed**. Only a database operator can change those settings; the application's service role cannot.
- Private tables/functions with browser-role access revoked and RLS enabled.
- Required immutable customer ownership for orders and invitation requests, checked at transaction commit. Existing atomic customer RPCs remain the creation path.
- Payment verification, recovery and already-created orders still operable when new sales are closed. Closing sales does not cancel Stripe checkouts or discard incoming payments.
- Gala accounting writers and connection access disabled. Empty compatibility tables/functions remain to avoid forking the tested ledger schema; no QuickBooks connection or sending is configured. Membership services are not included or changed.

`production-safeguards.sql` is an input fragment, **not** a standalone migration. Do not apply it separately or run the development SQL in a live project.

## Reproduce and rehearse locally

```powershell
node --import tsx scripts/gala-production-schema.mts --write
node --import tsx scripts/gala-production-schema.mts --check
node --import tsx --test tests/gala-production-schema.test.mjs tests/gala-live-access.test.mjs
```

`--write` only regenerates the local SQL file. `--check` verifies it against the reviewed source sequence and safeguards. Any source change requires regeneration, diff review and re-running the rehearsal. Tests execute the **same generated installation** in disposable PGlite databases. PGlite verifies SQL and privileges but does not reproduce multiple hosted PostgreSQL connections, Supabase project defaults, backups or real Stripe delivery.

## Hosted acceptance still required

1. Identify a fresh, separate production Gala project and verify the operator is in that project. Preserve membership and development projects. Provisioning/configuration is a separate authorized action.
2. After authorized application, verify the production marker, private grants/RLS, empty business tables, unlimited inventory and both closed flags. Record the exact release and SQL hashes. Never import the rehearsal's fixtures into production.
3. Bind server configuration to that project's exact URL and OSG live Stripe account; reject the development marker/URL and sandbox keys. Application routes currently still deny production. Do not enable routes by editing guards before the release requirements are met.
4. Connect live buyer ownership and shared admin/Dues access; install the appropriate live webhook and protected recovery schedule. Do not reuse Preview's automation bypass or development scheduler.
5. Complete live wording/deadlines, security review, configuration/recovery checks and final user release approval. Only then may the operator set `gala_operating_state.sales_open` and/or `invitations_open` to true. They are separate settings.

For an operational pause after launch, close the applicable new-submission flag while leaving webhook/recovery processing available. Never roll back by deleting paid records, resetting the database or disabling all payment notifications. A rollback build must retain the production schema and payment identity compatibility.

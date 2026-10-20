# Gala production database preparation

**October 20: applied to the authorized existing production membership project. Sales and invitations remain closed. Do not rerun the one-time installer.** See [staged setup and remaining release checks](STAGED_SETUP.md).

**October 20 decision:** use the existing production membership database for Gala, with separate `public.gala_*` objects. Keep the Gala development database separate. This supersedes the earlier dedicated-project plan.

`001_initial.sql` installs a fresh Gala schema alongside existing membership tables. It refuses any existing `public.gala_*` relation, function or type, including a partial installation or the Gala development environment, before changing anything. It is not an upgrade, copy or cleanup of the test database. Do not apply it until the production membership project is identified, a backup/recovery plan is verified, and the user authorizes the production application.

## What the installer contains

The existing, tested Gala schema sequence through migration 014 is packaged into **one transaction**, followed by production safeguards. Source filenames and normalized SHA-256 hashes appear inside the output. The packaging script has an explicit file allowlist; it never reads environment files or connects to providers. It changes the database marker to `osg-gala-production`, restricts payment binding/settlement to literal `cs_live_` identifiers, and records shared-admin changes as `shared-admin` rather than a named volunteer.

The committed result starts with:

- Zero orders, recipients, payment events, table assignments, staff accounts, accounting history or credentials.
- Three board-confirmed unlimited table tiers. Intermediate historical stock values are inside the same transaction and never published.
- New sales and invitation submissions **closed**. Only a database operator can change those settings; the application's service role cannot.
- Private Gala tables/functions with browser-role access revoked and RLS enabled, even when existing project defaults grant browser access. Membership grants, policies and shared default privileges are untouched. Future Gala migrations must explicitly secure their new objects in the same transaction.
- Required immutable customer ownership for orders and invitation requests, checked at transaction commit. Existing atomic customer RPCs remain the creation path.
- Payment verification, recovery and already-created orders still operable when new sales are closed. Closing sales does not cancel Stripe checkouts or discard incoming payments.
- Gala accounting writers and connection access disabled. Empty compatibility tables/functions remain to avoid forking the tested ledger schema; no QuickBooks connection or sending is configured. Membership services are not included or changed.

`production-safeguards.sql` is an input fragment, **not** a standalone migration. Do not apply it separately or run the development SQL in a live project.

Operator tools: `membership-baseline.sql` captures record/schema fingerprints without returning personal records or tokens; `verify-closed.sql` rejects a nonempty, open or incorrectly permissioned fresh installation. `stage-recovery.sql` stages an inactive schedule and generates its credential inside Vault without a literal secret in SQL. It is separate from the initial installer. These checks do not replace hosted application acceptance.

## Reproduce and rehearse locally

```powershell
node --import tsx scripts/gala-production-schema.mts --write
node --import tsx scripts/gala-production-schema.mts --check
node --import tsx --test tests/gala-production-schema.test.mjs tests/gala-live-access.test.mjs
```

`--write` only regenerates the local SQL file. `--check` verifies it against the reviewed source sequence and safeguards. Any source change requires regeneration, diff review and re-running the rehearsal. Tests execute the **same generated installation** in disposable PGlite databases, both empty and populated with the repository's membership migrations and fictional data. They simulate permissive project defaults and compare membership records, columns, constraints, policies, grants, functions, sequences and default privileges before/after installation and rollback. A separate route rehearsal exercises actual Dues roster, pricing and paid-status handlers through a narrow local SQL transport.

PGlite does not reproduce multiple hosted PostgreSQL connections, actual hosted schema drift/defaults, backups, PostgREST or real Stripe delivery. These are local regression checks, not a claim that production has been changed or inspected.

```powershell
node --import tsx --test tests/gala-live-routing.test.mjs
```

## Hosted acceptance still required

1. Identify the existing production membership project and verify the operator is in that project, not Gala Development. Before application, inspect its actual membership schema/grants against the rehearsal, confirm no existing `public.gala_*` objects, record membership counts/settings and verify a recoverable backup. This installer does not alter existing membership objects or copy test records.
2. After authorized application, verify unchanged membership records/settings/grants and Dues reads/writes, then the Gala production marker, private grants/RLS, empty Gala business tables, unlimited inventory and both closed flags. Record the exact release and SQL hashes. Never import the rehearsal's fixtures into production.
3. Bind `GALA_LIVE_SUPABASE_URL` to that same production membership URL and configure its server secret explicitly. Keep separate live/test variable names; no fallback to Preview credentials. Bind OSG's live Stripe account and reject the development marker/URL and sandbox keys. Application routes currently still deny production. Do not enable routes by editing guards before the release requirements are met.
4. Connect live buyer ownership and shared admin/Dues access; install the appropriate live webhook and protected recovery schedule. Do not reuse Preview's automation bypass or development scheduler.
5. Live wording and the scoped dependency review are complete, with residual findings in `GALA_DEPENDENCY_SECURITY.md`. Complete hosted configuration/recovery checks and final user release approval. The user has deferred operating questions as non-blocking. Only then may the operator set `gala_operating_state.sales_open` and/or `invitations_open` to true. They are separate settings.

For an operational pause after launch, close the applicable new-submission flag while leaving webhook/recovery processing available. Never roll back by deleting paid records, resetting the shared database or disabling all payment notifications. A rollback build must retain the production schema and payment identity compatibility. A whole-database restore would also affect membership: coordinate recovery and preserve subsequent Dues writes; do not use it as a casual Gala rollback.

# Live access wiring — prepared, not released

October 19, 2026. The feature branch connects the live buyer session, shared admin entrance and existing Dues workflow. `lib/gala/live-release.ts` deliberately has `LIVE_RELEASE_APPROVED = false`. No environment flag can open it. No production deployment, provider setting, hosted migration, password or membership record changed.

## Connected behavior

- Live customer pages automatically create a private, 24-hour buyer cookie through `/api/gala/session`; no shared code. Existing valid buyer identities are preserved. Creating orders/invitations always requires that buyer identity, even if an admin is signed in. Admin may inspect existing orders through protected endpoints.
- `/admin/login` posts to `/api/admin/session`; the existing `ADMIN_PASSWORD` is the shared Dues/Gala password. Password-bound sessions expire server-side after eight hours. Test, buyer and former `admin_session` cookies cannot authorize live admin access.
- Login validates the live database marker before consuming the durable global budget of 120 attempts per five minutes. Missing configuration, wrong database, storage failure, excessive attempts, large bodies and cross-origin writes fail closed.
- `/admin/dues` goes to the existing `/admin/belles-beaux` roster. Roster, add/edit, interest list and pricing keep their existing membership APIs/data. Shared navigation wraps these pages and replaces their duplicate website header/sign-out buttons. All `/api/admin/*` data routes enforce the live shared cookie and same-origin mutations in middleware. Server page guards also protect Dues/Gala entry points.
- Former Dues login/logout endpoints delegate to the shared session handlers after release. Shared login retires the legacy cookie; shared logout clears both admin cookies. Buyer cookie/cart remain separate when an administrator signs out.
- Board Preview still uses its existing test code, test cookies, sample Dues roster and membership-route denylist. Live test tools and named staff enrollment stay unavailable. Existing production Dues behavior remains unchanged while the release gate is closed.

## Configuration needed at the separately approved release

These names are prepared in code, **not populated in hosting**:

- `GALA_LIVE_ENABLED=true` plus an explicitly approved release commit opening the code gate; deployment must be production, not Preview.
- `GALA_LIVE_ORIGIN`: canonical HTTPS website origin, without a path/trailing slash. Confirm and pin the actual approved domain during release acceptance.
- `GALA_LIVE_SUPABASE_URL` and `GALA_LIVE_SUPABASE_SECRET_KEY`: the existing production membership project with the prepared Gala installation alongside Dues (October 20 user decision). Set the URL explicitly to the same project used by membership; retain separate live/test configuration names, with no credential fallback. Never use Gala Development. Confirm the actual project at release acceptance. Its Gala marker must be `osg-gala-production`. Installation must preserve existing membership schema, records and grants; follow `supabase/gala-production/README.md`.
- `GALA_LIVE_STRIPE_SECRET_KEY` and `GALA_LIVE_STRIPE_WEBHOOK_SECRET`: live-only OSG credentials. Payment operations still verify the pinned OSG live account before using it.
- `GALA_LIVE_SESSION_SECRET`: independent random 64-hex signing secret. Do not reuse the board code/development token. Rotation invalidates customer/admin sessions, so plan it around outstanding purchases.
- `GALA_LIVE_RECOVERY_SECRET`: independent random 64-hex bearer secret for the live scheduler only. Do not reuse the Preview recovery secret, development token, session secret, board code or admin password.
- Existing `ADMIN_PASSWORD`: preserve the chosen shared password, managed by Will. No new volunteer accounts.

Before activation: install and verify the fresh database, configure and rehearse webhook/recovery scheduling, confirm provider settings, and complete hosted acceptance. The live scheduler endpoint is wired and locally tested, but its hosted schedule and credential are not installed. The October 20 instruction defers operating questions as non-blocking; live wording is complete. The operating-state database flags remain closed by default. Closing new sales must preserve settlement of already-issued payments. None of these steps are authorized merely by building this wiring.

## Verification and limits

`npm run test:gala` includes live route integration with a test-only bundled gate substitution and fictional provider transport. The actual repository gate remains false. Tests exercise real handlers/middleware, buyer/admin separation, the original Dues roster handler, password rotation, expiry, legacy login/logout, CSRF, wrong database/configuration and Preview denial. The test transport rejects unexpected requests; no real membership record or payment is used. `esbuild` is explicitly declared for this isolated bundle, using the version already in the lockfile.

`npm run build` and `node --import tsx scripts/gala-board-http-smoke.mts` verify the shipped closed gate and current Preview/production boundary. An isolated browser fixture renders actual components with fictional data for desktop/390px checks; this is UI rehearsal, not proof of hosted live access. Release acceptance must repeat buyer/admin checks against the final configured deployment without synthetic real-money purchases.

## October 20: scheduled payment recovery prepared

The existing POST `/api/gala/recovery/run` now selects the live scheduler credential only after the hard-coded live release gate is enabled on production. With the current committed gate closed it remains unavailable in production even if credentials are present. Preview continues to use `GALA_RECOVERY_SECRET`; browser cookies cannot substitute for either credential. The live handler verifies the pinned OSG Stripe account and production database marker before claiming work. Existing shared database leases, five-order/90-second pass budget and the 300-second handler limit remain unchanged. A failed check retains the pending order for a later attempt; it never creates a checkout or charges a buyer again.

Validation: **175 Gala tests**, the production build and **82 built-app Preview/production HTTP checks** pass. The isolated live route rehearsal covers closed-gate denial, separate scheduler credentials, wrong account/database, provider outage, verified payment, unpaid expiration, cross-mode rejection and failed-save retries. No live services were contacted.

At the explicitly approved hosted setup, configure an independent scheduler to POST to the canonical live origin once per minute with `Authorization: Bearer <GALA_LIVE_RECOVERY_SECRET>`. Store the secret privately; keep it out of URLs, SQL checked into Git and logs. Use the production scheduler's secret, not the Preview Vercel bypass or browser/admin password. Do not modify the existing board scheduler. Confirm the request reaches this release, a successful empty pass updates the recovery heartbeat, and Orders shows automatic checks running. A 200 response only means the pass ran: review outstanding/retry entries too. Alert the site administrator for failed invocations, a stale heartbeat (three minutes) or unresolved retries; investigate before accepting further purchases if checks stay unhealthy.

Pausing new sales must leave the webhook and this worker running until issued payments settle. Do not use the global live release gate as a routine sales-pause switch: that would also stop settlement routes. Emergency rollback requires a plan for outstanding Stripe sessions and monitoring, not just disabling the website. No schedule, credentials, live provider requests or production records were created by this local preparation.

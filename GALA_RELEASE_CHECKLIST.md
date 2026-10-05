# Gala sales: launch is blocked

User instruction, September 28, 2026: keep this feature away from live until ready and tested. Firm inventory numbers are required. A generic request to push or publish does not waive this requirement.

## Development closeout boundary, October 5

Development completion and launch approval are separate milestones. The user agreed to two remaining passes: (1) real natural-expiration and recovery interruption/restart verification, fixing demonstrated defects; (2) review/closeout of accumulated branch changes, including the shared membership OAuth dependency, final regression checks, a consolidated checklist and saving reviewed work in Git. The user's full walkthrough remains part of acceptance. **Pass 1 completed October 5; pass 2 remains.**

Pass 1 evidence: Stripe naturally expired an unpaid checkout after its real 35-minute deadline; the normal recovery CLI released its held table exactly once, and a closed-order retry was rejected. Two actual child-process terminations exercised interruption after a hosted claim and after a verified expiration was saved but before queue completion. After the real five-minute leases elapsed, fresh recovery finished safely and rejected both stale owners. Both fixtures have no PaymentIntent/accounting job, and preexisting business records are unchanged. Thirteen focused regression checks and the harness TypeScript check pass. No application change, migration or launch action was needed. This completes the agreed development exercise, not every possible provider outage or production-hosting test; detailed evidence is in `GALA_BACKEND_DEVELOPMENT.md`.

Do not turn the historical progress notes or unchecked combined launch gates below into an open-ended development backlog. OSG decisions, production setup, and additional access/monitoring improvements must be tracked separately. All inventory, payment and explicit launch-authorization requirements still apply.

## Current local preview

Run `npm run dev` and open:

- `/gala/tables`: table tiers, ticket choices, extra seats, buyer details, no-refund acknowledgment.
- `/gala/gifts`: multiple student recipients, roses and cookie bags, buyer details.
- `/gala/invitations`: multiple mailing recipients and requester details.
- `/gala/preview/admin`: sample orders, inventory, paid/unpaid filters, table assignment, gifts and mailing statuses.

Use fictional data only. Without the backend flag, prototype orders are stored in this browser under `osg-gala-local-preview-v1` and send no information to providers. When `GALA_BACKEND_ENABLED=true` locally, table/gift forms and `/gala/preview/testing` make sandbox purchases, invitations save separate free requests, and `/gala/preview/admin` displays the development database. No physical mail or email is sent. See `GALA_BACKEND_DEVELOPMENT.md`. No production admin is implemented.

`requireGalaPreview()` requires local development and rejects any Vercel environment. All four routes return 404 in production. Do not remove the production or admin guard until the checklist below is complete and launch is authorized.

## Authorized client design review (September 29)

The user approved sharing the designs through a separate Vercel Preview deployment. This is not a sales launch or authorization to merge to main.

- Set `GALA_CLIENT_REVIEW=true` in Vercel's **Preview** environment for `codex/gala-2027-planning` only. A new deployment is required after saving the variable.
- Both `VERCEL_ENV=preview` and the exact opt-in value are required; production is blocked even if the flag is accidentally enabled there.
- `requireGalaPage()` permits only the three customer-facing designs in this mode. Local development retains its sample-order workflow.
- Hosted review never mounts the local order storage adapter. Personal-information inputs and submission buttons are disabled; selections/totals remain interactive.
- Middleware limits the review host to those three pages and static assets. All API routes, admin pages, student registration, and non-GET/HEAD requests return 404 before reaching handlers. Root redirects to `/gala/tables`.
- Review responses carry `X-Robots-Tag: noindex, nofollow, noarchive`. Page metadata also disables indexing. Noindex is not access control.
- Share only a verified **Preview** deployment using Vercel's Share dialog; do not promote it or change the production branch. Keep existing deployment protection and use a shareable link for external reviewers.
- Verify all three pages, disabled information/submission controls, blocked APIs/admin, noindex, and absence of client order-storage access before handing out links.

## Mandatory release gates

October 5 login protection: **99 Gala tests, 10 security tests and the build pass**. Migration 010 is applied only to OSG Gala Development. Staff password attempts now use durable, serialized limits of five per normalized email/15 minutes and 120 total/five minutes, keyed-hash buckets, bounded request bytes and fail-closed storage handling. Hosted HTTP testing passed 20 concurrent requests (five admitted password checks, 15 throttled), fixed-deadline preservation, forged-IP-header rejection, missing-schema denial and normal fictional-account login/logout. Browser wait messaging and six hosted permission checks passed. Business records/staff flags are unchanged; the test account is banned/disabled with no sessions, and ordinary development access is restored. These provisional limits do not close the access gate: production edge/per-network controls, trusted-proxy configuration, denial monitoring, MFA/account recovery, customer recovery and HTTPS/cookie acceptance remain open. See `GALA_BACKEND_DEVELOPMENT.md`. No production release or approval of the 20-per-tier placeholders.

October 4 access follow-up: opt-in local individual mode separates customer order ownership from named staff sessions, restricts accounting access, and attributes fulfillment/mailing/recovery edits to staff UUIDs. **92 Gala tests, 10 security tests and the build pass**. Browser/HTTP checks confirm customer session bootstrap, staff-route denial, shared-token rejection and production 404s. Migration 009 is **applied only to OSG Gala Development**; all 11 hosted schema/permission/data-preservation checks and independent Data API checks passed. Subsequent fictional-account testing passed hosted Auth login, role changes, rotation, named audit edits, revocation/logout and customer isolation; browser sign-in/preparation/logout also passed. One new checkout is verified expired/unpaid with no PaymentIntent/accounting job, and one fictional prepared invitation is retained. Existing records and unapproved stock are unchanged. The fictional account is banned/disabled, its sessions removed, and individual mode restored to disabled. Production HTTPS/cookies, abuse protection, MFA/account recovery, customer recovery, final role acceptance and deployment preparation remain open. This does not close the administrative-access gate or authorize launch. See `GALA_BACKEND_DEVELOPMENT.md`.

October 4 browser race follow-up: real sandbox 3D Secure/expiration testing passed both payment-winning and expiration-first outcomes. Exactly one $2,000 test charge/accounting job exists for the winning payment; the expired checkout remains unpaid with zero charges/jobs even after its old challenge was completed. Real Stripe webhooks returned 200. Silver retains one paid fixture, zero holds and 19 available of unapproved capacity 20. No QuickBooks sync or production action. Natural-deadline timing and hosted interruption/outage acceptance remain open; the broad payment gate is not checked off. See `GALA_BACKEND_DEVELOPMENT.md`.

October 4 payment/recovery review: **84 Gala tests and the build pass** after adding database deadlines and stronger canceled-payment matching before inventory release. Local HTTP/SQL tests cover stalled headers/bodies, a claim committed before response timeout, protected holds/leases and stale-owner rejection. The local worker restarted successfully. No migration or inventory change. These controlled tests do not close the real browser payment-at-expiry or hosted-outage gates; see `GALA_BACKEND_DEVELOPMENT.md`.

October 4 OAuth state follow-up: the development branch now protects the older membership QuickBooks callback with browser binding, server-side ten-minute expiry and atomic single-use state. **10 security tests and the build pass**; local HTTP checks reject unauthorized starts and invalid callbacks. The new membership migration is tested only in disposable local SQL and remains unapplied to hosted databases. Migration verification and a fresh sandbox authorization remain prerequisites before any authorized release of these shared routes. No live connection changed; see `GALA_DEPENDENCY_SECURITY.md`.

October 4 dependency follow-up: compatible updates reduced the audit from **29 affected packages to 10 (seven high, three moderate; zero critical)**. All **79 Gala tests, three security tests and the production build pass**. Updated-build HTTP checks preserve production 404s for Gala customer/admin/payment/recovery routes. Remaining `braces` and Intuit decoder chains, the callback mitigation and the separate existing membership OAuth state-validation gap are documented in `GALA_DEPENDENCY_SECURITY.md`. The security gate stays open; no production deployment or inventory approval occurred.

October 4 recovery follow-up: migration 008, a durable retry queue, a local one-minute worker and audited staff retry controls are implemented only in development. All **79 tests and the production build pass**. Hosted/browser verification covered independent claims, stale lease rejection, staff audit and scheduled settlement of a real expired sandbox checkout without accounting. Actual 390px review controls pass; production recovery GET/POST remain 404. The worker is running locally and requires this computer/process to stay active. Production hosting/monitoring, named staff access, missing-checkout investigation and remaining payment acceptance are still open. No launch gate or inventory requirement is waived.

October 4 payment failure follow-up: **72 tests and the production build pass**. New local coverage includes payment/expiration interleavings, save/response failures, signed stale/duplicate event handling, provider lookup outages and larger bursts. Hosted testing passed 24 independent reservations for three temporary slots, real Checkout create/expire calls with injected response loss, recovery around database saves, and nine synthetic signed HTTP notifications. Three test orders are verified expired with no accounting entries, and unapproved Platinum capacity is restored to 20. Real paid provider state was also replayed into disposable local SQL with one accounting job. Actual browser payment-at-expiry, genuine infrastructure outages, scheduled recovery and operator handling remain open; the broader payment release gate is not checked off. See `GALA_BACKEND_DEVELOPMENT.md` for evidence and limitations. No production launch, new card charge or QuickBooks write.

October 4 label follow-up: development label previews now use fresh authenticated invitation data, reject unresolved duplicate batches, exclude suppressed/mailed entries and leave mailing state unchanged. Provisional 30-per-Letter layout supports used-sheet offsets and prepared reprints; actual stock and physical alignment are unconfirmed. All **64 tests and the production build pass**. Hosted-data read checks, unauthenticated 401, production 404 and browser address-fit/overflow checks pass. Expanded duplicate review also passed at an actual 390px viewport. See the volunteer walkthrough in `GALA_BACKEND_DEVELOPMENT.md`. No physical printing/mailing, production changes or launch approval occurred. Cutoff, retention, staff permissions and workflow acceptance remain open.

October 4 duplicate resolution: keep-separate, reversible suppression and retained-entry links are implemented in the development admin; migration 007 is applied only to OSG Gala Development. All **62 tests and the production build pass**. Browser review/suppress/restore and hosted audit/retry/export/parallel-restore checks pass. Suppressed entries are excluded from mailing and exports; source/target revisions and retained/mailed-entry rules are enforced. Narrow 596px layout passes; exact 390px duplicate-control verification remains pending. Existing invitation and financial records were preserved. Labels, cutoff/retention, production permissions, board acceptance and all broader launch requirements remain open.

October 4 address editing: after the `89c30ad` baseline review and documentation cleanup, recipient/address corrections are implemented in development. Migration 006 is applied only to OSG Gala Development. All **57 Gala tests and the production build pass**. Browser correction, actual 390px layout, hosted audit/conflict/retry/mailed-lock checks and corrected CSV response pass. Production-mode invitation GET/POST/PATCH/admin remain 404; unauthenticated local PATCH is 401. Original submissions and financial records are preserved; prepared envelopes require preparation again after an edit, and mailed addresses are locked. Duplicate resolution, deadlines, retention, production permissions and acceptance remain pending. Dated evidence below records what passed at each milestone; unchecked gates still require complete acceptance. No production changes or launch authorization.

October 3 invitations: the flyer form now saves free requests to development with retry protection. Recipient-level preparation/mailed tracking, reasoned corrections, duplicate-review hints and CSV work in the local admin. Migration 005 is applied only to development; all 52 tests, final build, browser request/reload/status/export checks and hosted retry/conflict/audit checks pass. Invitations create no sales or accounting jobs. Production and client-review APIs remain blocked. Address corrections, duplicate resolution, mailing cutoff, retention and production access/acceptance remain pending.

October 3 gifts: paid-only per-student bundle preparation/handout, reasoned corrections, filters/totals and CSV are implemented in the local admin. Migration 004 is applied only to OSG Gala Development. All 46 tests and production build pass; browser save/correction/download checks and hosted conflicting-edit/audit checks pass without changing payment/inventory/accounting records. Production and client-review APIs remain blocked. Final gift cutoff, production per-user access and board fulfillment acceptance are still outstanding; this does not complete the release gates.

October 3 assignments: paid-only assignment controls, filters, CSV, uniqueness and stale-edit protection are implemented and covered by the 42-test suite. Migration 003 is applied only to OSG Gala Development; browser assign/clear/filter checks and hosted conflicting-edit/CSV checks pass. Changes preserve orders, inventory and accounting; audit rows record old/new assignments. Table numbers are development labels; neither actual layout nor inventory is approved. Production admin permissions and all existing launch gates still apply.

October 3 form integration: the local table/ticket and gift flyer forms now submit to the isolated sandbox backend, retain the original checkout attempt for retries, and display server-verified return status. Actual browser tests completed a $60 two-student gift payment and verified unpaid expiration of a $2,500 Silver-plus-two-seats checkout. All 38 Gala tests and the production build pass. Production route checks block the forms, payment return, and supported new API methods; client-review checks preserve design access/noindex and block all payment APIs/admin. This is local-only progress, not launch approval. Invitation persistence and local fulfillment were completed later that day. Public authentication/fulfillment, scheduling, deadline/capacity rules and broader acceptance tests remain unfinished.

Accounting decision clarification: one Symphony Ball revenue category is the request; per-order versus combined-total posting and its cadence remain unconfirmed. The current sandbox receipts are a provisional implementation. Confirm that choice along with expense/bank/clearing mappings and matching responsibilities before final accounting acceptance.

October 2 accounting follow-up: sandbox-only OAuth and manual SalesReceipt worker implemented; migration 002 applied to development only. **35 automated Gala tests pass**, including two actual local worker terminations with disk-backed test databases, fake provider receipts and simulated lease expiry. Four new QuickBooks routes are blocked in production. Actual sandbox OAuth, token refresh, mapping and receipt tests pass: $4,375 Gold receipt 145, $30 gift receipt 146, each with one Symphony Ball line and no duplicates. Injected lookup, lost-response and save failures around real Intuit/hosted-database operations recovered the gift receipt with one POST and preserved fulfillment/inventory. Read-only Stripe fee evidence is available; no payout exists or has been reconciled, and no fees/payouts have been posted to QuickBooks. Public sandbox syncing remains disabled. Genuine hosted outages, fee/payout accounting and treasurer review remain pending. These partial results do not satisfy the accounting release gate.

October 2 backend progress: see `GALA_BACKEND_DEVELOPMENT.md`. Isolated database schema, local payment lab and authenticated database admin implemented. Hosted last-table race, Stripe idempotency and verified-expiration tests passed; 22 automated checks and build passed. Actual hosted test-card success, decline, simulated 3D Secure and CLI-forwarded completion/expiration webhooks passed. Paid gifts retained student and item details; expired unpaid orders produced no accounting entry. All six APIs and local testing/admin/payment pages returned 404 in production mode. Public form wiring, production admin permissions/fulfillment, scheduling and QuickBooks remain incomplete; these partial results do not complete the broader release gates below.

Client-review verification, September 29: all 10 model/access tests passed; preview-mode and production-mode builds passed. A local production-mode server configured as Vercel Preview returned 200/noindex for the three designs and 404 for admin, existing APIs, student registration, and submission requests. Browser review confirmed interactive Platinum + two seats totals $6,875 while buyer fields and submission remain disabled. A separately built production configuration returned 404 for all four Gala prototype routes even with the review flag set to true; the existing homepage remained 200. Actual hosted deployment verification is still required after Vercel setup.

- [ ] Board confirms firm Platinum, Gold, and Silver quantities. **20 each is test data only.** Record who confirmed the figures and when.
- [ ] Confirm ticket and total venue capacity, including rules for extra seats.
- [ ] Approve checkout hold duration, payment methods, and delayed-payment handling.
- [ ] Configure an isolated Stripe test account/environment and isolated database; no production credentials in previews.
- [ ] Implement server-side price validation and atomic inventory reservations; browser storage is replaced entirely.
- [ ] Implement Stripe redirect Checkout, signed events, amount/currency/order matching, duplicate protection, and reconciliation.
- [ ] Test the last-table race, double submits, old checkout pages, payment at expiry, interrupted responses, outages, and duplicate/out-of-order notifications.
- [ ] Prove inventory releases only after verified provider expiration; uncertain or processing payments retain their hold.
- [ ] Confirm administrative access, audit logs, contact-data retention, and paid-only fulfillment exports.
- [ ] Implement QuickBooks synchronization and prove retries do not duplicate revenue. Treasurer approves Symphony Ball category, fees, refunds/corrections, and payout reconciliation.
- [ ] Confirm gift cutoff year and exact local time; enforce it server-side. Confirm invitation mailing cutoff.
- [ ] Confirm final limits for multiple-table purchases, ticket quantities, gifts, and invitations.
- [ ] Verify no-refund acknowledgment and receipt wording; provide an exceptional correction/dispute process without assuming refunds or restocking.
- [ ] Test desktop/mobile checkout and admin with actual Stripe test payments, not only simulations.
- [ ] Board/user explicitly authorizes launch after reviewing the results and final inventory.
- [ ] Review and resolve applicable dependency security findings. Next.js critical findings are cleared by the October 4 upgrade; remaining advisory chains and follow-up are in `GALA_DEPENDENCY_SECURITY.md`. Membership OAuth state protection is implemented locally; verify its migration and fresh sandbox authorization before releasing these shared changes.

No launch date is currently authorized. Initial sandbox payment flows pass; full acceptance testing and live integration remain incomplete.

## Model checks

`node --test tests/gala-model.test.mjs`

These check exact flyer pricing, seat counts, gift quantities, demo status transitions, and the production guard. They do not prove Stripe cancellation or transactional database safety.

## September 28 preview verification

- Eight model tests passed; TypeScript check and production build passed.
- All four new routes returned HTTP 404 from a local production-mode server.
- Desktop and 390px phone layouts reviewed.
- Browser workflow: Gold plus two extra seats produced a $4,375 unpaid order, consumed one table hold, and returned availability to 20 after simulated verified expiry.
- Browser workflow: one rose and two cookie bags produced a $30 gift order with student details. It appeared in the paid view only after simulated payment.
- Browser workflow: fictional invitation request preserved its address and advanced from requested to prepared to mailed using explicit simulation controls.
- No real payments, production records, deployment, or third-party account setup performed.

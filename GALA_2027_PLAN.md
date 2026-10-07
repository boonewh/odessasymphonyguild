# Gala 2027: decisions, payment research, and implementation handoff

Last updated: October 6, 2026 (America/Chicago).

## Resume here

### October 6: functional board Preview implementation prepared

The user authorized starting the hosted-test setup. Code now supports an explicitly opted-in functional Preview only on the existing Gala branch, Vercel project and HTTPS branch alias. Shared board access uses a separate code from the signing secret; cookies are Secure/HttpOnly and survive the Stripe return. The three customer forms, payment return and five admin tabs are allowed, while membership routes, engineering labs, QuickBooks writes and production remain blocked. A separately authenticated scheduled recovery endpoint and optional Supabase Cron setup are prepared. Board members intentionally share visibility of fictional test records.

**108 Gala tests, the build and 47 built-app Preview/production HTTP checks pass.** No cloud settings, secrets, schedules, webhooks or deployments have changed. Credential/service-access confirmation is pending before Vercel configuration; after configuration, deploy this feature branch and complete a real hosted purchase/admin/recovery walkthrough. Exact setup instructions are in `GALA_BACKEND_DEVELOPMENT.md`. This is the requested test-hosting work, not production readiness or inventory approval.

### October 6: board review preparation

The user requested a full, test-only Vercel walkthrough of customer purchases and every Gala admin section. The interface cleanup is implemented locally: plain test-site labels, a short walkthrough and test-card help, clearer payment/accounting statuses, expandable order references, organizer-only disclosures, and optional manual invitation comparison. **100 Gala tests and the build pass.** Chrome checks verified the revised customer/admin screens without writing records.

The current hosted mode is still design-only; this cleanup does not enable hosted purchases or admin access. The bounded next step is a protected functional Preview deployment, with Preview-only backend access/HTTPS cookies, hosted Stripe test notifications and payment recovery, followed by one complete hosted buyer/admin walkthrough. Keep unrelated site navigation outside the board test path. Vercel access and the existing September 29 branch preview are now verified in Chrome's Will profile; see the board-review section in `GALA_RELEASE_CHECKLIST.md` for the exact project, URL and protection settings. No push, deployment, production change or inventory approval occurred.

### October 6: walkthrough usability follow-up

The user's first walkthrough surfaced status-filter confusion, unclear duplicate-review controls and misleading wait cursors; those local UI fixes are recorded in `GALA_BACKEND_DEVELOPMENT.md`. At the user's request, the database admin is now organized into on-page tabs: Orders (inventory and recovery), Table assignments, Gifts, Invitations and Accounting. Tabs retain filters and unsaved work; recovery warnings remain visible across sections. This is a scoped usability follow-up, not an expansion of production readiness or a launch authorization. All stock remains unapproved development inventory.

### Agreed development finish line (October 5)

The user asked for a finite end to development, excluding other people's decisions and production setup. The remaining scope is **two closeout passes**, not an expanding improvements backlog:

1. **Complete October 5 — recovery verification:** observed Stripe's real 35-minute checkout expiration and terminated/restarted recovery processes against hosted development. Both five-minute leases elapsed naturally; stale owners were rejected, the open hold remained protected, and the normal recovery CLI released the naturally expired checkout exactly once. Both new fixtures are unpaid/expired with no PaymentIntent or accounting job; preexisting records and unapproved inventory are unchanged. No application defect surfaced. The 13 focused recovery/database regression checks and the acceptance harness TypeScript check pass. Details are in `GALA_BACKEND_DEVELOPMENT.md`.
2. **Complete October 5 — engineering branch closeout:** reviewed the accumulated changes, fixed failed staff-session rotation, separated the unrelated membership OAuth rollout dependency, and passed **100 Gala tests, 3 retained OAuth security tests, the build, 33 production-mode HTTP checks and 18 development HTTP checks**. Work is saved locally in Git on the Gala branch. The user's own full walkthrough is still pending; no additional feature work is queued as part of this closeout.

After those passes, stop development pending decisions/deployment. Additional MFA, self-service recovery and monitoring work belongs in explicitly scoped production-access or improvement work; it must not silently expand this closeout. This does not waive launch requirements. Older dated “next” lists below are historical, not additional instructions to keep expanding development.

**Ready for the user's development MVP walkthrough.** Local preview: `http://localhost:3000/gala/tables`; admin: `http://localhost:3000/gala/preview/admin`. The local app, Stripe sandbox listener and recovery worker are running as of this closeout and require this computer/processes to remain active. Access is the existing shared local development mode; opt-in named staff mode remains disabled after its earlier rehearsal. Use fictional details and sandbox payments only.

The membership state-validation routes, migration and seven associated tests are preserved on local branch `codex/membership-oauth-hardening` at `14803d4`. They have been removed from the current Gala checkout; it retains the shared callback-parser mitigation and three SDK tests but has no dependency on `qb_oauth_attempts`. No shared database migration or authorization was performed. The older membership state-validation gap remains separate work before releasing membership changes; separating it is not a claim that the legacy flow is hardened. See `GALA_DEPENDENCY_SECURITY.md`.

### October 5: staff login abuse protection verified in development

Staff sign-in now checks durable database limits before calling Auth: five attempts per normalized email in 15 minutes and 120 total admissions in five minutes. Counters use keyed hashes, survive application restarts, and serialize concurrent attempts; denials do not extend the fixed deadline. Missing/unavailable limit storage blocks sign-in, and oversized request bodies are rejected. The form explains the wait after throttling. These are provisional engineering limits, not approved production access settings.

**99 Gala tests, 10 security tests and the build pass**. Migration 010 is applied only to OSG Gala Development. Hosted HTTP testing admitted exactly five of 20 concurrent attempts and throttled 15, rejected forged-IP-header bypass, preserved the deadline, and passed normal fictional-account login/logout. Hosted SQL verified private table/RPC permissions. Original business records and staff flags are unchanged; the fictional account is banned/disabled with no application sessions, and the usual development access mode is restored. See `GALA_BACKEND_DEVELOPMENT.md` for evidence and limits.

Production-access follow-up (outside the bounded development closeout): staff MFA/account recovery, customer recovery, production access/deployment preparation and hosted monitoring. Production edge/per-network protections and denial monitoring remain necessary: an attacker can still consume an email's allowance or the global allowance for its bounded window. The membership migration remains unapplied and is preserved on its separate branch, with no current Gala dependency. No push, production release or stock approval; **20 tables per tier remains unapproved placeholder inventory**.

### October 4: customer/staff access separation prepared

An opt-in local individual-access mode now gives customers browser-bound order ownership and staff separate named sign-in with revocable database sessions. Accounting endpoints require an additional permission; fulfillment/mailing/recovery edits recheck access transactionally and record the staff UUID. Production and hosted review remain blocked. **92 Gala tests, 10 security tests and the build pass**, with browser sign-in/form review and actual HTTP customer/staff separation and production 404 checks.

Migration 009 is now **applied to OSG Gala Development** following the user's explicit instruction. All 11 hosted verification checks and independent Data API checks passed. A subsequent fictional-account rehearsal also passed real Auth login, role checks/changes, session rotation, named staff edits, revocation/logout and isolation between customer cookie sessions. Actual browser staff sign-in, invitation preparation and logout passed. A new unpaid sandbox checkout was verified expired with no PaymentIntent/accounting job; one fictional prepared invitation is retained as evidence. All preexisting records and inventory are unchanged. The fictional account is banned/disabled, its sessions removed, and individual mode disabled again after testing. Next: production HTTPS/cookies, abuse protection, staff MFA/recovery, customer recovery and deployment/worker preparation. See `GALA_BACKEND_DEVELOPMENT.md` for evidence and limits. No release, stock approval or OSG role decisions are implied; **20 tables per tier remains unapproved placeholder inventory**.

### October 4: browser payment/expiration acceptance

Actual Stripe sandbox browser checks now cover both outcomes: one $2,000 Silver-table payment won against a concurrent expiration attempt and produced exactly one charge/accounting job; a second checkout expired while authentication waited, and completing its stale challenge produced no charge or accounting job. Real Stripe completion/expiration webhooks returned 200. Both orders are settled, with no unresolved holds. Silver now has one retained paid fixture and 19 available of the unchanged **unapproved** capacity 20. QuickBooks was not synced. See `GALA_BACKEND_DEVELOPMENT.md` for order references and evidence.

Next: hosted interruption/restart acceptance and natural-deadline timing. These explicit-expiration cases do not prove genuine infrastructure outages or all timing/payment-method combinations. Last automated baseline remains 84 Gala tests, 10 security tests and the build passing; only documentation and ignored evidence were added. No production release or inventory approval.

### October 4: payment/recovery review and fixes

The deeper review added 20-second database request deadlines, including stalled response bodies, and tightened canceled-payment verification before releasing inventory. Five new tests cover stalled networking, a recovery claim committed before its response times out, preserved holds/leases, stale-owner rejection and mismatched payment identities. **84 Gala tests and the build pass**; the separate security suite last passed 10 tests. The local recovery worker was restarted successfully. See `GALA_BACKEND_DEVELOPMENT.md` for scope, evidence and limits.

Next: real browser payment-versus-expiration and hosted interruption/restart acceptance. Missing-checkout investigation, production operations/access and accounting decisions remain open. No migrations applied, new charge, accounting write, production deployment or inventory change. **20 tables per tier remains unapproved placeholder stock.**

### October 4: membership OAuth state protection

The older membership QuickBooks connection now validates browser-bound, ten-minute, single-use state before exchanging a code. Atomic database consumption rejects simultaneous/replayed callbacks; missing storage fails closed. **10 security tests and the build pass**. The migration is prepared and tested only in disposable local SQL, not applied to any hosted database. A fresh sandbox authorization and migration verification are required before an authorized release of these shared routes. Existing tokens and Gala OAuth are untouched. Details and remaining work are in `GALA_DEPENDENCY_SECURITY.md`; continue with deeper payment/recovery review. No production release or inventory approval.

### October 4: dependency security review

Compatible dependency updates reduced the npm audit from **29 affected packages to 10 (seven high, three moderate; zero critical)**. Next.js and its ESLint configuration are now 16.3.8; Intuit OAuth is 4.2.5. All **79 Gala tests, three security tests and the production build pass**. Local production-mode HTTP checks still block Gala customer/admin/payment/recovery routes. The local development server and sandbox recovery worker were restarted successfully.

Two advisory chains remain: build/lint pattern parsing through `braces`, and the Intuit SDK's legacy URI decoder. All application token-exchange entry points now bound and normalize callback fields before that decoder, with actual SDK regression coverage; this mitigation does not remove the audit finding. The separate, older membership OAuth flow also needs state validation in a deeper security review. See `GALA_DEPENDENCY_SECURITY.md` for evidence and remaining work. No release gate is waived; **20 tables per tier remains unapproved placeholder stock**. Nothing pushed or deployed.

### October 4: durable recovery worker and staff review queue

All **79 tests and the production build pass**. Migration 008 is installed only in OSG Gala Development. The local worker (`npm run gala:recover`) polls due payments every minute in bounded passes, with durable retries, expiring claims and backoff; it covers the full pending queue beyond 100 orders. Admin staff can see unresolved cases and queue an audited retry without forcing payment or inventory changes. Hosted/browser checks verified competing claims, stale-token rejection, staff retry audit and automatic settlement of a real expired sandbox checkout with no accounting entry.

The development worker is running but requires this computer/process to stay active. Production hosting/monitoring, named staff access, missing-checkout investigation controls and remaining payment acceptance are still open. No production release, new card charge, QuickBooks write or inventory approval. **20 tables per tier remains unapproved placeholder stock.** See `GALA_BACKEND_DEVELOPMENT.md` for operation and evidence.

### October 4: payment failure testing expanded

All **72 tests and the production build pass**. Eight new local payment tests cover expiration races, lost responses, database saves, lookup outages, concurrent reservations and repeated/out-of-order notifications. An isolated hosted exercise passed 24 requests competing for three temporary slots, real Stripe create/expire response-loss recovery, repeated signed HTTP requests and paid-session replay into disposable local SQL. The three hosted test orders are expired; no accounting entries were created for them, and Platinum inventory is restored to its original **unapproved** 20. No new card charge or QuickBooks write occurred.

The browser payment-at-expiry race and genuine infrastructure outages still need acceptance testing; simulated interleavings and injected failures do not close those gates. See `GALA_BACKEND_DEVELOPMENT.md` for exact evidence. Scheduled reconciliation/operator recovery remains the next engineering task. Production remains blocked and all board decisions are still required.

### October 4: invitation label preview and phone verification

Development admin now offers a printable label preview using fresh invitation data, with a provisional 30-per-Letter-sheet layout and a 0–29 used-label offset. It blocks unresolved duplicate matches (including other mailing statuses), excludes suppressed/mailed recipients, supports explicit prepared-label reprints, and changes no mailing state. Long addresses that cannot fit at readable size block printing. Actual stock and physical printer alignment still need confirmation. All **64 tests and the production build pass**; authenticated hosted-data label checks, production 404, and browser fit/overflow checks pass. Expanded duplicate controls also passed at an actual 390px viewport. See `GALA_BACKEND_DEVELOPMENT.md` for the volunteer walkthrough and evidence.

Next engineering work: scheduled payment reconciliation and operator recovery. Remaining mailing decisions: stock/alignment, cutoff, retention, production volunteer permissions and board workflow acceptance. No production launch or inventory approval; **20 tables per tier remains unapproved placeholder inventory**.

### October 4: duplicate resolution implemented in development

Local admin now records keep-separate decisions for specific pairs, suppresses reviewed duplicates with a retained-entry link, and restores suppressed entries. Suppressed invitations cannot enter mailing or any mailing export. Mailed entries, retained addresses, revision conflicts and duplicate chains are protected; original submissions and financial records are preserved. Migration 007 is applied only to OSG Gala Development. All **62 tests and the production build pass**; actual browser keep-separate/suppress/restore and hosted audit/CSV/concurrent-restore checks pass. Narrow 596px layout passes; exact 390px duplicate-control verification remains open. See `GALA_BACKEND_DEVELOPMENT.md` for evidence and limits.

Next: remaining mailing operations (labels, cutoff/retention, volunteer permissions and acceptance), plus the payment/accounting release backlog. No production launch, push or inventory approval. **20 tables per tier remains unapproved test inventory.**

### October 4: address editing implemented in development

Quick overview review completed on `89c30ad` with 52 passing tests, followed by documentation cleanup and invitation address editing. All **57 tests and the production build pass on October 4**. Migration 006 is applied only to OSG Gala Development. Browser correction, hosted audit/conflict/retry/mailed-lock checks, corrected CSV response and actual 390px layout pass. Address edits preserve the original request, require reasons, reset prepared envelopes to needs preparation, and block changes to mailed addresses. See `GALA_BACKEND_DEVELOPMENT.md` for evidence and limits.

Duplicate resolution was subsequently completed as described above; remaining mailing operations and acceptance are still pending. Broader payment failure tests, reconciliation scheduling, production permissions, deadlines/retention and treasurer decisions remain open. No release gate was waived: 20 tables per tier is unapproved test inventory and no production launch is authorized. Nothing pushed or deployed.

Dated entries below record progress at that time; use this resume section and the backend development document for current status.

### October 3: invitation persistence and mailing workflow

The invitation flyer form now saves free, multi-recipient requests to the development database with stable retry IDs. Local admin supports separate recipient preparation/mailed status, audited corrections, conservative duplicate name/address hints, filters and mailing CSV. Migration 005 is applied only to OSG Gala Development; all 52 tests, production build, actual browser submission/reload/status/export and hosted retry/conflict/audit checks pass. No payments, accounting entries, email or physical mailing occur. Production and client-review submissions remain blocked. Address correction/duplicate resolution, label printing, deadlines, retention, production permissions and board acceptance remain unfinished. See `GALA_BACKEND_DEVELOPMENT.md` for evidence and limits. Nothing pushed or deployed.

### October 3: table assignments implemented and tested in development

Paid-table assignment controls, global duplicate-number protection, revision checks, audit history, filters and CSV export are implemented on the Gala branch. All 42 automated checks and the production build pass; assignment APIs/exports remain blocked in production and client design review. Migration 003 is applied to OSG Gala Development. Browser assignment/clearing/filter checks and hosted simultaneous/stale-edit tests pass. The existing fictional Gold purchase is assigned to demonstration table 7. See `GALA_BACKEND_DEVELOPMENT.md`. Assignment numbers are placeholders, do not approve inventory, and do not include Belles/Beaux or individual-ticket seating.

### October 3: flyer checkout wiring and pending accounting decisions

The tables/tickets and gift flyer forms now use the existing isolated Stripe backend when local sandbox mode is enabled. Buyer and recipient details are saved before redirecting to Stripe-hosted card entry. The same attempt is retained across reloads and retries; the return page reads verified server state. Hosted client design review remains read-only, and production remains blocked. Invitations subsequently gained database persistence and mailing tracking; see the invitation section above. See `GALA_BACKEND_DEVELOPMENT.md` for the new browser-test evidence.

Britni's accounting answers may arrive Monday. Her messages establish one **Symphony Ball revenue category**, but do not settle whether QuickBooks should receive one transaction per order or combined totals, nor the grouping period. The existing one-SalesReceipt-per-order sandbox implementation is provisional, not a treasurer-approved requirement. A combined-total approach remains possible but needs its own durable grouping, retry and reconciliation design and tests before use. Keep individual paid orders and fulfillment details regardless of the accounting choice. Fee expense account, bank account, clearing-account setup and bank-feed matching responsibilities also await her answers. OSG still does not have its own Stripe account. No fee/payout writes or live accounting changes are authorized by this progress.

### October 2: first backend implementation

Accounting follow-up: separate sandbox OAuth, encrypted token storage and manual SalesReceipt sync are implemented; development migration 002 is applied. Actual OAuth, refresh, mapping and receipt tests pass for Sandbox Company US a37d. The fictional $4,375 Gold purchase synced to receipt 145 without duplicate retries. The $30 gift purchase created receipt 146; injected lookup, lost-response and save failures around real sandbox operations recovered that receipt with one POST, preserving paid gift details and inventory. Two local disk-backed process-termination tests also pass, using fake provider receipts and simulated lease expiry. All 35 Gala tests pass. Read-only Stripe fee evidence is $4,405 gross / $128.80 fees / $4,276.20 net, still pending with no payout; it is not an OSG live-rate quote. Both jobs are synced; public sandbox syncing remains disabled. No live connection changed. Hosted outage tests, fee/payout posting and treasurer acceptance remain pending. See `GALA_BACKEND_DEVELOPMENT.md` for evidence and limitations.

The sandbox backend and local payment lab are implemented; see `GALA_BACKEND_DEVELOPMENT.md` for setup, tests and remaining work. The development schema is installed in OSG Gala Development. Actual hosted concurrent reservations and Stripe checkout creation/idempotency/expiration passed. Browser tests now also cover successful table payment, card decline followed by verified release, and a gift payment with simulated 3D Secure. Actual Stripe CLI webhooks updated the development database and paid admin without manual reconciliation. The local admin reads this database when the backend flag is enabled; the client flyer preview remains unchanged. Test credentials stay local; production and hosted previews reject the APIs. Customer forms, local fulfillment and provisional QuickBooks sandbox sync have since been implemented. Full race/outage acceptance testing, production access/fulfillment, scheduled reconciliation and final accounting acceptance remain outstanding. The account-setup notes below describe the earlier steps; their statements about the then-unimplemented schema are historical.

### October 2: Stripe development account

- Will corrected the setup account: he signed out of his personal-email login and is proceeding under **his business-email Stripe login**. This supersedes the earlier personal-email note. Do not confuse this with an OSG-owned account. Stripe MCP now verifies access to **PathSix Solutions sandbox**, with `livemode=false`; this is the actual connected name, replacing the proposed name `OSG Gala Development`. No live account or CABC account was exposed by the connection.
- OSG does not yet have its own Stripe account. The treasurer will create the Guild's account and handle business verification and banking separately.
- Use a dedicated isolated sandbox under Will's account for fictional-data development, alongside an isolated test database. Never use his live payments, customers, or accounting for OSG testing.
- Move the integration to OSG's own sandbox and repeat acceptance tests when that account is ready. This is a configuration handoff, not a transfer of Will's business Stripe account. Recreate account-specific settings/resources and webhook configuration as needed; test transactions are not live sales.
- Board design approval is still pending. Backend development may proceed, but all existing production launch requirements remain in force. Keep the client design preview stable while payment work is tested separately.
- Will saved `GALA_STRIPE_SECRET_KEY` in Git-ignored `.env.local`. A read-only Stripe account request verified that the test key authenticates to the expected PathSix Solutions sandbox on October 2. The credential was not printed or committed. The website does not yet consume it, and no Checkout Session or charge was created. Guide setup one screen at a time; do not ask for secret keys in chat.
- Will created a separate **OSG Gala Development** Supabase project in the same paid organization as live OSG, accepting the additional project cost. `GALA_SUPABASE_URL` and `GALA_SUPABASE_SECRET_KEY` are saved only in Git-ignored `.env.local`. A read-only Data API metadata request succeeded on October 2 and exposed zero application table/function endpoints, consistent with a fresh project. No migrations or records have been written. Use a server user agent for secret-key checks: PowerShell's default browser-like user agent was rejected with 401. Database schema, reservation logic, and payment webhooks still need implementation.
- The official Stripe plugin was installed and MCP OAuth completed successfully. The implementation planner is available and its decision tree confirmed web-based, Stripe-hosted Checkout. Will explicitly clarified that the generated onboarding prompt mentioning Connect does not change the OSG scope: this is not a PathSix Connect platform.
- Planner-guided implementation direction: server-created one-time Checkout Sessions, with prices calculated on the server and an order reference linking Stripe to the Guild's fulfillment records. The existing browser-local prototype is not a Stripe integration. Build atomic database reservations before enabling checkout; use signed, idempotent payment events and reconciliation to finalize orders or release verified expired holds. Send only confirmed paid sales to the QuickBooks sync queue. Checkout duration and production release gates remain unresolved; sandbox credentials and a separate development database are now available. MCP authorization grants development tools access; it does not supply the running website with an API key.

The Guild wants to automate table/ticket sales, celebration gifts, and mailed-invitation requests. The three-page structure below is approved. **Stripe redirect Checkout with QuickBooks synchronization has initial approval.** Card details must be entered on Stripe's website. Dues may also move to Stripe, but that is a separate decision still awaiting confirmation.

The Intuit research below is historical background. Stripe is the current direction; the first backend and limited sandbox checks are now implemented as described above. Full successful-payment, webhook and accounting acceptance testing remains incomplete. See `GALA_RELEASE_CHECKLIST.md` for launch blockers and local preview instructions.

## September 29 flyer design direction

- User subsequently approved a shareable client-review deployment on Vercel Preview, with guidance through setup. This permits reviewing the three designs only; production, admin, APIs, saved orders, and payment flows remain blocked. See the client-review section in `GALA_RELEASE_CHECKLIST.md`.

- Recreate the three supplied flyers as responsive webpages, not full flyer images with clickable overlays. Prices, descriptions, headings, links, and forms remain actual accessible HTML.
- Match the ivory paper, black-and-ivory stripes, double gold borders, teal satin bows, flowers, pearls, script headings, and teal price ribbons. Separate decorative images support the layout without carrying essential information.
- The tables, celebration gifts, and mailed-invitation pages share this visual treatment; the preview admin retains its functional dashboard layout.
- Preserve approved wording: An Evening of Timeless Elegance and La Hacienda. Flyer imagery does not override these decisions.
- Artwork provenance and generation prompts are documented in `GALA_ARTWORK.md`.
- This is a local visual revision only. All release blockers and production route guards remain in place.

## September 28 decisions and first implementation

- Use **La Hacienda** for now; the venue name could still change.
- Use **20 Platinum, 20 Gold, and 20 Silver tables exclusively as development placeholders**. Firm board-confirmed quantities are mandatory before launch. Never silently treat these values as approved capacity.
- Current Guild policy: **all sales final, no refunds**. Display it and require acknowledgment in paid-order forms. Future policy changes or exceptional provider disputes still need a deliberate workflow.
- Keep Gala work on `codex/gala-2027-planning`, away from main and production until ready, tested, and explicitly approved for launch. The user specifically requested resisting premature launch even if they later casually ask to publish.
- Keep expired unpaid orders separate from paid seating and fulfillment. No unpaid order is sent to QuickBooks. Retention duration for abandoned contact data remains undecided.
- Treasurer wants detailed fulfillment in the website and all Gala revenue categorized as **Symphony Ball** in QuickBooks. This is not an instruction to erase individual transaction records. Donations and Dues remain separate revenue categories.
- First local preview: `/gala/tables`, `/gala/gifts`, `/gala/invitations`, `/gala/preview/admin`. Orders use fictional details and browser-only storage. Admin defaults to paid purchases and can simulate payment/verified expiry, assign tables, review gift recipients, and advance invitation mailing statuses.
- The preview routes return 404 in production and hosted environments, regardless of other configuration. No payment endpoints, live database migrations, public Gala links, Stripe charges, emails, or QuickBooks records are added.
- This prototype is not evidence of safe concurrent reservations or payment settlement. Production requires a separate transactional server adapter and verified Stripe events. Browser state is never acceptable as production inventory authority.
- Temporary preview limits: one table per order, up to ten ticket units, up to twenty gift/invitation recipients. These are review boundaries, not approved final business rules.

Launch timing is unknown. Work belongs on a separate branch and eventually a reviewable PR; do not merge or deploy this feature until launch is authorized. The current local documentation branch is `codex/gala-2027-planning`. This document does not authorize production charges, account changes, or deployment.

## Approved decisions and boundaries

- Keep `/gala` as the event hub.
- Add three focused flows: `/gala/tables`, `/gala/gifts`, and `/gala/invitations`.
- Tables and individual tickets belong in the same purchasing flow.
- Use a shared Gala administration area for orders, gifts, and invitation mailing work.
- Sell seats exactly as advertised. Do not account for Belles/Beaux seating or subtract their attendance from a purchased table's eight seats.
- An unpaid invoice must not reserve a table indefinitely. The board wants inventory available again when someone does not complete payment.
- A brief inventory hold while payment processes is explicitly accepted to prevent duplicate sales.
- A checkout window while a buyer enters card details on another site is **not yet explicitly approved**, and no duration has been chosen. This is broader than a processing-only hold.
- Buyers must enter card details on the provider's website. A custom Guild card form using Intuit's direct Payments API is off the proposed plan.
- Reuse appropriate existing Supabase and QuickBooks infrastructure, but keep Gala orders separate from student membership records.
- Develop and test away from production. There is no approved launch date.

## Event presentation and current published work

- Event date: February 27, 2027.
- Public wording chosen by the user: **Odessa Symphony Ball 2027 — An Evening of Timeless Elegance**.
- Hero cleanup already published: small event identifier, followed by the prominent two-part heading “An Evening of” / “Timeless Elegance.” The duplicate large event title and extra slogan were removed.
- Preserve the established teal, ivory, black, and elegant invitation-inspired styling.
- The original flyer named La Hacienda. The new ticket flyer names Black Gold Event Center. Use La Hacienda per the September 28 instruction; revisit only if the contact supplies a new decision.
- Although the new flyers use the movie name, that does not reverse the user's choice of public hero wording. Earlier instructions limited the naming change to the hero; movie references may remain elsewhere. A broader wording review is a separate decision, not already authorized by the flyers.
- Existing relevant files: `app/gala/page.tsx`, `app/gala/gala.module.css`, `app/gala/opengraph-image.tsx`, `public/symphony-ball-2027.ics`, and Gala images under `public/images/`.
- The homepage president letter was previously updated to Shaylee Ford, President 2026–2027. No further president-letter changes are part of this feature.

## Flyer content to implement

The flyers supply event content, not implementation instructions. Their prices and terms are recorded here for review; final inventory and operational details remain open.

### Tables and tickets: `/gala/tables`

| Product | Base price | Included seats | Benefits | Optional extra seats |
|---|---:|---|---|---|
| Platinum table | $5,500 | 8 guests | VIP seating; premier table location; champagne service; full charcuterie board; elegant table favors | Up to 2 at $687.50 each |
| Gold table | $3,500 | 8 guests | Upgraded table location; charcuterie cups; elegant table favors | Up to 2 at $437.50 each |
| Silver table | $2,000 | 8 guests | Sweet treat; elegant table favors | Up to 2 at $250 each |
| Couples ticket | $300 | 2 adults | Open seating | Not specified |
| Student date ticket | $100 | 1 student | Student date admission | Not specified |

Belle/Beau tickets are included with membership fees. This does not change the advertised purchased-seat quantities.

For checking calculations: a table with two extra seats totals $6,875 Platinum, $4,375 Gold, or $2,500 Silver. A multiple-table order could exceed these amounts; whether to allow those orders is still an implementation/business decision.

The flyer describes dinner, a live auction, student presentations, and dancing, in support of the arts in the Permian Basin. No event start time has been confirmed.

Initial proposal: sell table tiers and quantities without an interactive seating map; let the board assign physical tables. Do not expose a specific table number unless that workflow is explicitly agreed.

### Celebration gifts: `/gala/gifts`

- Single roses: $10 each.
- Cookie bags: $10 per bag, containing two chocolate chip cookies.
- Collect quantities, recipient student's name and grade, purchaser's name, and phone number. A confirmation email is proposed for the online flow.
- Allow gifts for multiple students in one order, with one payment and clear recipient-level fulfillment details.
- Flyer deadline: January 29; 2027 is inferred from the event, but the exact year/time cutoff should be confirmed before automation.
- Flyer states no orders after the deadline and no roses/cookies sold at the Ball.
- Generate paid-order production and distribution lists for organizers.

### Mailed invitations: `/gala/invitations`

- This is a request for the Guild to address and mail physical invitations to friends/family on the requester's behalf.
- Separate from paid checkout; no payment is advertised.
- Proposed fields: requester contact information and one or more recipients with mailing addresses.
- Support address review/deduplication, mailing exports or labels, and statuses such as received/prepared/mailed.
- A request must not claim an invitation was mailed before staff actually complete that step.

### Gala administration

Approved overall direction: one administration area with separate sections for tables/tickets and payments, gifts/fulfillment, and invitation mailing. Exact screen design, access roles, exports, guest-list handling, and cancellation workflow remain to be specified.

## Payment terminology: avoid repeating earlier confusion

| Term | What it means here | Decision |
|---|---|---|
| Custom direct-payment form | Guild website supplies card-entry UI and uses a Payments API; tokenization may send card data directly from the browser to the processor | Off the proposed plan following the user's objection |
| Redirect to provider checkout | Buyer leaves the Guild site and enters payment details on the provider's site | Required direction |
| QuickBooks standalone Payment Link | A payment request created separately from an invoice | No verified unpaid expiration/cancellation API; unsuitable as the current inventory design |
| QuickBooks invoice payment page | Intuit checkout attached to a particular invoice | Separate candidate, conditional on voiding/race tests |
| Stripe Checkout Session | Provider checkout created for a particular order, with documented session expiration | Alternative candidate; would require Stripe setup and QuickBooks synchronization |

Do not use “hosted card entry” without specifying a redirect. Do not imply that tokenization is the same as the provider supplying the entire payment page, or that it eliminates security obligations.

## What the research established

Research was conducted September 23–24, 2026. These are documentation findings, not successful account-specific tests.

### QuickBooks standalone payment links

- Intuit documents one-time links expiring after use. [Payment-link instructions](https://quickbooks.intuit.com/learn-support/en-us/help-article/payment-methods/payment-links-quickbooks-desktop/L6onPNJpn_US_en_US)
- Multi-use links/Buy buttons do not expire. [Buy Button instructions](https://quickbooks.intuit.com/learn-support/en-us/help-article/payment-processing/create-buy-button-quickbooks-online/L13HQhTU7_US_en_US)
- The reviewed Online management instructions list reminders, viewing, and editing unused links, but do not document canceling an unpaid link.
- No published, supported API operation for automatically expiring/canceling an unpaid standalone link was verified. Absence from this research is not proof that every Intuit product lacks every manual option.
- Older Pay Link terms discuss turning off a business's public payment page; this does not establish per-order automatic cancellation. [Older terms](https://quickbooks.intuit.com/payments/legal/toc102017/paylink/)
- Removing a website button or expiring our own order does not disable a provider URL already open in someone's browser. Therefore those actions alone cannot protect released inventory.

### Candidate A: Intuit invoice checkout with automatic voiding

Intuit's API supports voiding invoices using the invoice ID and current SyncToken. Voiding retains the record and zeros amounts; it is different from deleting an invoice or canceling a standalone payment link. [Invoice API](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/invoice)

An Intuit support response says invoice links remain active until paid or voided. This supports investigating the idea but does not document every in-flight-payment race. [Support response](https://quickbooks.intuit.com/community/other-questions-9/new-invoice-has-expired-link-89310)

Proposed flow, not yet selected:

1. Atomically reserve available inventory when the buyer proceeds to payment.
2. Create the order-specific invoice and redirect to Intuit.
3. Confirm the order only after authoritative verification of the required payment.
4. When the agreed checkout window ends unpaid, attempt to void the invoice.
5. Release inventory only when the payment's final state and inability to complete later have been established.

Critical unknown: can an already-open page or in-flight charge still complete across the void operation? A read of the balance followed by a void is not an atomic payment lock. Never assume the SyncToken proves there is no payment in flight. If cancellation fails or payment is uncertain, retain the hold for reconciliation and alert staff when necessary.

Other tradeoffs: abandoned purchases leave voided invoices; automatic invoice emails/reminders need deliberate handling; a due date is not a payment cutoff; partial payments and delayed bank transfers complicate confirmation. Card-only checkout was recommended for initial investigation, not approved as final policy.

Pass condition: prove provider-side payment rejection after cancellation, including stale/open pages and concurrent submissions, and prove safe resolution of ambiguous outcomes. If this cannot be established, reject this design for limited inventory.

### Candidate B: Stripe redirect Checkout plus QuickBooks accounting

Stripe allows the server to create an order-specific Checkout Session and redirect the customer to the provider's page. [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions)

Stripe documents expiration of an open session and states that an expired session cannot be completed. If the session is no longer in an expirable state, expiration returns an error; our system must retrieve/reconcile its state rather than release inventory blindly. [Expire a session](https://docs.stripe.com/api/checkout/sessions/expire)

Proposed flow: reserve inventory → redirect to Stripe → verify payment → confirm order → synchronize the accounting record to QuickBooks. For abandonment, confirm provider-side expiration before releasing inventory. Any recovered/new session must obtain a fresh availability check and reservation.

This was the stronger documented cancellation capability of the two candidates. Stripe has since been selected and implemented in an isolated sandbox; see the current development evidence above. It requires a Guild Stripe account, review of fees/eligibility, a chosen checkout duration supported by the final implementation, refunds/reconciliation, and reliable QuickBooks synchronization. QuickBooks remains the accounting system; Stripe processes these purchases.

### Accounting and account checks

- A sales receipt represents an immediately paid purchase. Final account/category mapping and any automatic provider-created entries must be verified with the treasurer to prevent duplicate revenue. [Intuit sales-record explanation](https://quickbooks.intuit.com/learn-support/en-us/help-article/accounting-bookkeeping/difference-invoice-sales-receipt-bill-statement/L1K8yZiie_US_en_US)
- Intuit's Payments SDK confirms direct-charge/status/refund capabilities, but those capabilities do not establish a redirect checkout. [Official SDK](https://github.com/intuit/PHP-Payments-SDK)
- Verify actual processing rates, per-transaction/aggregate limits, and approval for advance event sales. Do not infer account terms from nonprofit status or from existing invoice acceptance. [QuickBooks Payments terms](https://www.intuit.com/legal/terms/en-us/quickbooks/online/)
- Bank transfers can be returned; accepting a payment request is not final settlement. Cards can also be disputed. [Intuit ACH guidance](https://quickbooks.intuit.com/learn-support/en-us/help-article/money-movement/fix-rejected-ach-payments-fees-quickbooks-payments/L4e8UkDSc_US_en_US)
- A custom form and a provider redirect can have different security assessment obligations. No design should be described as eliminating all merchant obligations. [PCI explanation](https://www.pcisecuritystandards.org/faqs/1291/), [Intuit PCI guidance](https://quickbooks.intuit.com/learn-support/en-us/help-article/data-security/quickbooks-pci-service-faqs/L7ipNg7n9_US_en_US)

## Existing integration findings to address

Read-only source inspection; no fixes were made during this planning discussion.

| File | Finding / next action |
|---|---|
| `app/api/quickbooks/auth/route.ts` | Requests both Accounting and Payments scopes. This does not prove currently granted permissions or merchant eligibility. |
| `lib/quickbooks/invoice-service.ts` | Existing student invoice flow enables cards and ACH and uses a 30-day due date. Do not carry those semantics into Gala inventory accidentally. |
| `app/api/quickbooks/webhook/route.ts` | Invoice update events call `markStudentPaidByInvoiceId` without fetching/verifying actual payment. Payment events find a linked invoice but do not verify the required amount. Correct this behavior before relying on it for new orders; consider the existing membership impact separately. |
| `lib/quickbooks/tokens.ts` and authorization/callback routes | Review connection identity, authorization-state validation, token persistence, and concurrent refresh behavior before adding checkout traffic. Existing connection code is not proof of checkout readiness. |

Zero invoice balance alone must never be treated as proof of successful payment: a void also zeros the invoice. Gala events must never accidentally update student membership payment status.

At the original September planning check, local `.env.local` was absent and sandbox testing had not begun. Sandbox credentials and payment tests were added in October; refunds, account-limit checks and production payment tests remain unverified. Older README/setup status statements may not reflect current production; verify rather than rely on them.

## Inventory and recovery requirements

These are engineering requirements. Several now have development implementations; see the backend document for verified behavior and remaining gaps.

- The database, not a displayed availability count, must enforce capacity with atomic reservations.
- Keep order, inventory reservation, payment attempt, and accounting-sync status distinct.
- Compute amounts and enforce product rules on the server; use exact monetary arithmetic.
- Persist a payment attempt before contacting the provider and use that provider's documented duplicate-request protections. Verify retry behavior in testing.
- Never retry an ambiguous charge as a new attempt until its earlier outcome is reconciled.
- Never release a reservation solely because the browser closes, the return page is not visited, a timer fires, a webhook is delayed, or an API request times out.
- A failed/uncertain cancellation means the reservation remains pending, not available for resale. Recovery jobs and staff-visible exceptions are needed.
- Signed provider notifications and authoritative payment checks drive confirmation; browser redirects alone do not prove payment.
- Payment success followed by bookkeeping failure must preserve the paid order, queue synchronization, and avoid charging again.
- Refunds and inventory reopening are separate actions. A partial refund must not automatically release a whole table.
- All sales channels, including any staff-entered sales, must use the same inventory controls.
- Keep a useful audit trail without logging card data, credentials, or unnecessary personal information.

## Open decisions

| Question | Status / owner |
|---|---|
| Correct venue name: La Hacienda or Black Gold Event Center? | La Hacienda selected for now, subject to later change. |
| Number of Platinum, Gold, and Silver tables; individual-ticket capacity; total venue capacity? | 20 of each tier for development only. Firm counts required for launch; ticket/venue capacity still unknown. |
| Intuit-only processing required, or willing to add Stripe? | Stripe sales with QuickBooks sync has initial approval. |
| Short checkout window while entering card details, and its duration? | Needs board agreement; processing-only hold is already approved. |
| Refunds, cancellations, substitutions, and restocking policy? | No refunds is current policy. Exceptional corrections, substitutions, and restocking still need rules. |
| Cards only initially, or bank transfers/checks/offline purchases? | Cards recommended for immediate confirmation; final policy not decided. |
| Allow multiple tables per order and later extra-seat purchases? | Not decided; would affect inventory and payment-limit checks. |
| Gift cutoff year/time, timezone, and production/fulfillment rules? | January 29 flyer deadline; exact cutoff unconfirmed. |
| Invitation submission cutoff and mailing workflow? | Not decided. |
| Fees, accounting categories, receipt wording, and applicable tax treatment? | Treasurer/accountant to confirm; do not invent settings. |
| Event start time and feature launch date? | Unknown. |

## Test plan and release gates

The scenarios below remain the acceptance plan; several have partial development evidence documented in `GALA_BACKEND_DEVELOPMENT.md`. They are not all complete. Tests must use an isolated database/test company and provider sandbox credentials; preview environments must not use production payment or student data.

### First feasibility test

Prove one complete purchase through the chosen provider: reservation → provider redirect/card entry → verified payment → order confirmation → correct QuickBooks record → refund. For Intuit candidate A, cancellation of an already-open unpaid invoice page and payment-at-cancellation races are prerequisites, not optional later tests.

### Required scenarios

- Two buyers race for the final table; only one can acquire the reservation.
- Double-clicks, multiple browser tabs, repeated requests, and retries cannot duplicate purchases or charges.
- Buyer closes checkout before paying; reservation ends through verified provider cancellation/expiry.
- Buyer submits payment at the expiration boundary or from an old open page.
- Provider completes payment but the response is lost; system recovers without reselling or recharging.
- Provider refuses cancellation because payment is complete or processing; inventory remains protected.
- Network outage, expired authorization, failed token refresh, and payment-provider outage.
- Duplicate, delayed, out-of-order, invalidly signed, and wrong-account notifications.
- Website/database failure after payment; durable reconciliation restores the correct state.
- QuickBooks accounting sync fails after payment; retry creates exactly one sale and correct fee/deposit records.
- Full and partial refunds, retrying refund requests, and explicit inventory-restocking decisions.
- Every advertised price, quantity, extra-seat cap, and capacity rule; no Belles/Beaux seat deduction.
- Gift multi-recipient quantities/totals, paid-only fulfillment lists, and exact deadline enforcement.
- Invitation address handling, exports, access controls, and truthful mailing statuses.
- Phone/tablet/desktop checkout, clear cancellation/processing messages, accessible forms, and confirmation delivery.
- Treasurer review of real accounting output from the test flow.

Mocks are useful for screens and logic but do not prove payment cancellation, provider account readiness, or bank reconciliation. Any later real-money acceptance test requires a separately agreed plan and must follow provider rules.

### Release gates

1. Resolve payment feasibility and select a provider.
2. Confirm business rules and inventory.
3. Implement on a feature branch with isolated test configuration.
4. Complete the meaningful payment/inventory failure tests and treasurer review.
5. Prepare a PR with evidence, remaining limitations, and launch instructions.
6. Obtain launch authorization before merging/deploying; earlier authorization to publish the Gala hero does not authorize these sales features.

## October 3 gift fulfillment progress

Paid-gift preparation and handout tracking now persist in the development database, one complete bundle per order/recipient. The local admin includes status filters, quantity totals, CSV and audited corrections with stale-edit protection. Migration 004, 46 automated tests, production build, browser workflows and hosted conflict/audit checks pass; details and limitations are in `GALA_BACKEND_DEVELOPMENT.md`. No new payment, QuickBooks posting, push or production deployment was performed. Final cutoff, volunteer access, workflow acceptance and all release requirements remain pending. Invitations subsequently gained database persistence and mailing tracking; see the invitation section above.

## Original documentation handoff (September 24)

- Decisions, source material, corrections, unresolved questions, and testing requirements documented.
- Documentation branch created locally.
- No Gala purchasing implementation, payment setup, database migration, PR, push, or deployment performed as part of this documentation task.
- Existing `.codex-remote-attachments/` content is unrelated untracked material; do not add it to feature commits.

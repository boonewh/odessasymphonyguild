# Gala backend development

This is a local, sandbox-only backend on `codex/gala-2027-planning`. It is not enabled on the customer preview or production. When enabled locally, the table/gift flyer forms and separate testing page create Stripe sandbox checkouts; the admin reads the development database. Invitations remain a browser-only prototype.

## October 3: paid gift fulfillment

- Added a paid-only gift panel below table assignments. Each order/recipient has its own bundle of roses and cookie bags, student/grade and buyer contact details. Same-name students are never silently merged. Filters show needs preparation, prepared, handed out or all; totals and CSV reflect the selected view and all matching paid orders, not only the latest 100.
- Migration `supabase/gala-development/004_gala_gifts.sql` adds private fulfillment and audit tables plus service-only functions. It was applied successfully to **OSG Gala Development** (`rhjwjfyjjdsfahlegqvd`). Status changes do not update orders, inventory, payments or accounting. Bundles must be prepared before handout; correcting to an earlier status requires a reason. Every actual change records prior/new status, revision and the shared `local-development-admin` identity. Production per-user attribution is still required.
- `GET /api/gala/gifts` reads the list; `?format=csv&filter=all|pending|prepared|delivered` exports it. POST accepts only order ID, recipient index, status, revision and optional correction reason. Existing local authentication/environment guards apply. Stale edits are rejected; uncertain saves require refresh before retry. Browser database roles cannot read the tables or invoke their functions. CSV quotes/escapes fields and neutralizes spreadsheet formulas.
- Verification: **46 Gala tests pass**, including actual SQL in isolated PGlite for paid-only eligibility, same-name separation, ordered transitions, no-op behavior, corrections, stale edits, audit history, browser-role denial and 125-row CSV. Production build passes. Actual production/client-review HTTP checks return 404 for gift GET/POST/CSV; unauthenticated local calls return 401. The added client-review path assertions also pass.
- Hosted development checks found three existing fictional paid recipients, five roses and four cookie bags. Two simultaneous updates with the same revision returned one 200 and one 409; a reasoned correction restored the test row while a complete orders/inventory/accounting snapshot remained unchanged. Browser checks prepared and handed out one student bundle, verified filtered totals, and restored it with a reason. The other recipient on the same order stayed unchanged. Five expected audit events and correction reasons were confirmed in the hosted database. The actual export button downloaded a CSV containing all three recipients. No new payment or QuickBooks record was created.
- Narrow-panel visual review confirms stacked rows and usable filters/export at the effective 596px browser width. Exact 390px testing remains outstanding. Fulfillment currently tracks whole bundles only; partial handouts, final cutoff enforcement, production permissions and board workflow acceptance remain pending. All test bundles are back to needs preparation. No push, production change or deployment.

## October 3: table assignments

- Added a paid-table-only assignment panel in the local database admin. It shows buyer, tier, purchased seats and current table number; supports assigning, changing and clearing; filters all/assigned/unassigned; and exports the selected view to CSV. Individual tickets, gifts and Belles/Beaux seating are excluded.
- Migration `supabase/gala-development/003_gala_assignments.sql` adds private assignment and audit tables. Table numbers 1–999 are development labels, not an approved layout or inventory increase. A database unique constraint prevents duplicate numbers across tiers. Revision checks reject stale edits; assigning the same value is a no-op. Clearing retains the revision and audit history. Existing paid status, order details, inventory and accounting are untouched.
- Every change records old/new numbers and revision under `local-development-admin`; this is a shared sandbox identity, not production per-user attribution. Production authentication and access/audit review remain release requirements.
- List/export use a single database snapshot of all paid table purchases, independent of the latest-100 general order list. CSV quotes cells, escapes embedded quotes and neutralizes formula prefixes in buyer data. Exports are labeled DEVELOPMENT ONLY.
- Validation: all **42 Gala tests passed**, including SQL paid-only eligibility, duplicate assignment attempts across tiers, conflict rollback, stale edits, clearing/reassignment, audit history, denied browser-role access, and 125-row CSV output. Tests use isolated PGlite, not a hosted concurrent-client race. Production build passed. Actual HTTP checks returned 404 for assignment GET/POST/CSV in production and client review, and 401 for unauthenticated local requests.
- Migration 003 applied successfully through the SQL Editor to **OSG Gala Development** (`rhjwjfyjjdsfahlegqvd`) after user sign-in. Browser checks assigned the existing fictional paid Gold order to test table 7, cleared it, checked assigned/unassigned filters, and restored 7. Two simultaneous HTTP edits against the hosted database using the same revision returned one 200 and one 409; another stale edit was rejected. Restoring the assignment left the complete orders/inventory/accounting dashboard unchanged. A provider audit lookup verified old/new numbers and revision history. Authenticated CSV returned the one paid table and its ten purchased seats. No new payment or QuickBooks record was created. These checks do not prove a venue layout or production admin authorization. No production changes or deployment.
- The actual admin export button downloaded `gala-2027-development-table-assignments.csv`; its contents matched table 7, Gold, ten seats and the fictional buyer. Narrow-panel review verified stacked assignment fields with no panel overflow at the browser's effective 596px width. The browser did not honor the requested 390px override, so an exact 390px device check remains unverified. Desktop layout uses the existing admin table style; narrow screens use stacked rows.

## October 3: flyer forms connected locally

- `/gala/tables` and `/gala/gifts` now use authenticated sandbox checkout when `GALA_BACKEND_ENABLED=true` in local development. The same flyer renderer still serves the read-only client preview. Invitations remain a browser-only demonstration.
- The form validates and persists the exact request UUID and selections before sending. Reloading or switching between the two forms in the same tab retains that attempt; retries reuse it. Only verified paid/expired status enables starting another order. This does not yet coordinate independently opened tabs or provide production customer authentication. Corrupt storage and unresolved/non-created attempts conservatively require operator review; polished out-of-stock/recovery handling remains pending.
- `GET /api/gala/session` checks the local cookie. `GET /api/gala/order?orderId=UUID` exposes only order reference, state, kind, description and amount to authenticated local testers. POST reconciles with pinned sandbox Stripe and can return the same open hosted checkout. Neither return URL parameters nor browser state can mark an order paid. Production and hosted review block these endpoints.
- Browser test: Silver plus two extra seats opened Stripe at **$2,500** using order `cad4a696-6450-489e-b20b-232ca85429c1`. An initial network-restricted server attempt failed safely; restarting with sandbox service access and retrying retained the same UUID. Returning from Stripe did not mark it paid or release it. Explicit cancellation verified expiration; admin showed Silver **20 available, zero held, zero paid**.
- Browser test: gift order `1c749bd9-790a-4161-aa98-82d156e98f97`, **$60**, completed with Stripe's 4242 test card. The return page showed verified paid status. Paid admin retained Fictional Student One, grade 9, two roses/one cookie bag, and Fictional Student Two, grade 12, one rose/two cookie bags. Accounting is pending with sync disabled. No live money or books changed.
- `npm run test:gala`: **38 passing tests**, including persisted form payload validation, Stripe redirect restrictions, return references and review isolation. Production build passed. A production-mode local server returned 404 for the customer pages, payment return and supported checkout/session/order API methods (GET on the POST-only checkout route is 405). Unauthenticated local order GET/POST returned 401. The same build running as opted-in Vercel Preview served all three designs with noindex and disabled submission, and blocked APIs/admin/payment return.
- Treasurer decisions remain pending: per-order versus combined-total posting/cadence, income/fee/bank/clearing mapping and matching responsibilities. Current sandbox receipts are provisional. Additional release tests, public admin/fulfillment, automated reconciliation, final quantities/capacities and deadline enforcement are still required.

## Implemented October 2, 2026

- Server-side validation and exact-cent quotes for tables, tickets, and multi-recipient gifts. Purchases require the no-refund acknowledgment.
- A separate Supabase development schema with private orders, inventory, payment-event records and an accounting outbox. Applied to **OSG Gala Development** using its SQL Editor; it refuses initialization in a nonempty public schema.
- Atomic table reservations: a per-tier row lock protects capacity, and a request-ID advisory lock makes simultaneous repeated submissions idempotent. Pending and paid orders both consume inventory. Elapsed time alone never releases a reservation.
- Server-created Stripe-hosted Checkout, limited to card payments for development. Prices, USD currency, metadata and return URLs are controlled on the server. No abandoned-checkout recovery or adaptive currency pricing.
- Stable Stripe idempotency keys. Creation retries older than four minutes retain inventory for investigation rather than risk creating a second checkout. This is a conservative recovery limit, not the customer's checkout duration.
- Signature verification using the raw webhook body. Payment state is fetched from Stripe; matching order/session/account mode/currency/amount and successful PaymentIntent checks are required. Completed-but-unpaid sessions remain pending.
- Atomic paid/expired transitions and duplicate event protection. A paid order cannot become expired, and an expired order cannot become paid automatically. Conflicts require investigation.
- Exactly one accounting-outbox row per paid order under `Symphony Ball`. A manually triggered sandbox sync now records one SalesReceipt per order, with one Symphony Ball line. No QuickBooks transaction has been sent yet; sandbox authorization and company mappings are still pending.
- Reconciliation can verify/expire linked pending sessions. Unknown creation outcomes remain held for review. The endpoint is manual, limited to 100 pending records per call; scheduling, paging and operator recovery are still needed.
- Local payment lab and database admin, protected by an eight-hour signed HttpOnly/SameSite cookie and same-origin write checks. The development token is never embedded in page source. This is not production staff authentication.
- The official Stripe CLI forwards sandbox events locally. Link is disabled per Checkout Session because its wallet can offer bank/financing choices even when the allowed payment method is card.

## Local configuration

Secrets are in ignored `.env.local`. `.env.example` contains empty placeholders only.

```env
GALA_BACKEND_ENABLED=false
GALA_STRIPE_SECRET_KEY=
GALA_STRIPE_WEBHOOK_SECRET=
GALA_SUPABASE_URL=
GALA_SUPABASE_SECRET_KEY=
GALA_DEVELOPMENT_TOKEN=
GALA_LOCAL_ORIGIN=http://localhost:3000
```

Start these in two terminals, in this order:

```sh
npm run gala:listen
npm run gala:dev
```

`gala:listen` verifies the pinned Stripe account, obtains the CLI signing secret, generates a development token if needed, and saves the local settings in ignored `.env.local` without printing secrets. Keep the listener running. Restart the dev server if its signing secret changes. The server binds to loopback only.

Open `http://localhost:3000/gala/preview/testing` and unlock it with `GALA_DEVELOPMENT_TOKEN` from `.env.local`. Use fictional details and Stripe test cards only. The admin is `http://localhost:3000/gala/preview/admin`. It shows paid orders by default, with separate pending and expired views. Successful sales enter the accounting outbox; its QuickBooks panel reports sandbox setup and permits individual test syncs only after configuration.

The runtime pins both the development Stripe account and Supabase URL in `lib/gala/backend/config.ts`, checks a development database marker, rejects live keys, and rejects all Vercel environments and `NODE_ENV=production`. These are deliberate development barriers, not the eventual production configuration.

- `POST /api/gala/checkout`: requires the development cookie or `x-gala-development-token`, JSON `requestId` UUID, `kind`, `contact`, `allSalesFinal: true`, and `purchase` or `gifts`. Reuse the same request ID for retries; do not mint a new one after an uncertain response. The test UI preserves this attempt across reloads in session storage.
- `POST /api/gala/webhook`: requires Stripe's valid signature; accepts Checkout completed/expired/async-success/async-failure events. Unrelated sessions are ignored. Database failures return 500 for delivery retry.
- `POST /api/gala/reconcile`: requires development authentication. Does not create replacement checkout sessions.
- `POST /api/gala/session`: exchanges the local token for an eight-hour cookie; requires the configured local Origin.
- `GET /api/gala/orders`: authenticated dashboard of latest 100 orders and inventory counts.
- `POST /api/gala/expire`: authenticated development-only early expiration; verifies the provider state before releasing inventory.
- `/gala/preview/payment`: shows the authenticated database admin; a browser redirect never marks an order paid.

Checkout expires 35 minutes after reservation **for development testing only**. Stripe's timed expiration needs at least 30 minutes from session creation; the extra five minutes allows short creation retries. The agreed production checkout window is still undecided. Earlier provider-side expiration was exercised successfully in testing. A scheduled shorter hold has not been implemented.

## Validation performed

```sh
node --import tsx --test tests/gala-backend.test.mjs tests/gala-model.test.mjs tests/gala-client-review.test.mjs
npm run build
```

`npm run test:gala` now runs 35 tests covering pricing, consent, inventory limits, repeat requests, ambiguous creation, payment matching, duplicate/out-of-order transitions, denied browser database access, signatures, local session authentication, accounting recovery, provider failures, process termination and environment guards. Database tests execute the real SQL in ephemeral PGlite PostgreSQL, including two disk-backed child-process crash cases. PGlite alone is not proof of hosted multi-connection concurrency.

Additional checks used the actual Stripe sandbox and hosted development database:

```sh
node --env-file=.env.local --import tsx scripts/gala-stripe-smoke.mts
node --env-file=.env.local --import tsx scripts/gala-hosted-smoke.mts
```

- A real $4,375 test Checkout Session was created; an identical idempotency key returned that same session.
- Two independent hosted RPC requests raced for one temporary Gold table; exactly one obtained the reservation.
- The winning hosted order linked to Stripe; repeat checkout reused the same session. Provider-confirmed expiration released inventory, preserved the expired order, and created no accounting sale.
- The temporary Gold capacity was restored to 20. All three tiers remain **unapproved development placeholders**.
- The initial smoke checks did not submit a card; browser payment checks below now extend that evidence.
- The production build passed. With local `GALA_BACKEND_ENABLED=true`, all six payment API routes and the testing/admin/payment pages still returned 404 under a local production-mode server.

### Browser payment checks, October 2

- Gold table plus two seats, $4,375: Stripe's standard success test card completed hosted Checkout. Actual CLI-forwarded `checkout.session.completed` returned HTTP 200; the database admin showed paid, one Gold table consumed, and one pending accounting entry without manual reconciliation.
- Silver table, $2,000: Stripe's generic-decline card displayed a decline. Returning from checkout kept the table held and created no accounting entry. The authenticated expiration action and actual expiration webhook returned success; inventory returned to 20, while the expired unpaid record remained in history.
- Gifts, $30: Stripe's authentication-required test card displayed the simulated 3D Secure challenge. Completing it produced a real sandbox completion webhook (HTTP 200). The paid admin retained Sample Student, grade 9, two roses and one cookie bag. No table inventory changed.
- The gift Checkout visibly offered card entry/Apple Pay without Link, bank or Klarna after the per-session wallet restriction.
- Desktop and 390px mobile admin checked. No page-wide horizontal overflow; the order table scrolls within its panel.
- All data is fictional and all payments are sandbox transactions: **no real money moved**. Two paid test orders remain for review. These results do not prove payment-at-expiry races, durable outage recovery, refunds, bank payouts or accounting correctness.

The hosted smoke script changes development Gold capacity temporarily and keeps its audit record. Only run it while no other Gold reservations are active. It refuses a different project or Stripe account.

## QuickBooks sandbox accounting, October 2

### What is implemented

- `002_gala_accounting.sql` was applied successfully to **OSG Gala Development**. It adds durable receipt payloads, worker leases, dispatch markers, provider receipt IDs and encrypted sandbox token storage. Production database migrations were not changed.
- Dedicated local OAuth routes under `/api/gala/quickbooks/`: `connect` (POST), `callback` (GET), `status` (GET), `sync` (POST). Connect/sync require local authentication; the callback verifies the browser's random state cookie and exact configured sandbox company before exchanging its code. The four routes returned HTTP 404 in a production-mode server.
- The existing `intuit-oauth` library and encrypted-token approach are reused, but Gala uses its own configuration and token table. There is no fallback to membership credentials or the live `qb_tokens` table. Token refresh/save is serialized by a database lease; failed refresh persistence requires reconnecting/review rather than overwriting a newer connection.
- One gross paid order becomes one SalesReceipt with a single **Symphony Ball** item line, posting into an explicitly selected Stripe clearing account. It does not create an unpaid invoice, charge a card, or send a receipt email. The order UUID and Stripe PaymentIntent identify the sale; gift-recipient/contact information stays in the website database.
- Receipt date comes from the successful Stripe charge in America/Chicago, not the sync date. Mapping checks require a US/USD sandbox, an active service/noninventory item mapped to the configured Symphony Ball income account, an explicit active customer and a Bank/Other Current Asset clearing account. A common sandbox customer is a test arrangement only; the treasurer must approve the eventual production customer policy.
- The exact company and payload are frozen before dispatch. A database marker is saved before POST. All retries of a dispatched order are **lookup-only**: a matching receipt is recovered and verified; no match, conflicting totals/references, multiple matches or an uncertain provider result goes to review. No code automatically clears the dispatch marker. This favors stopping for review over risking duplicate revenue, including a crash immediately before the network request.
- A stable QuickBooks `requestid` accompanies the first POST, but duplicate prevention does not assume unlimited provider idempotency retention. It relies on durable dispatch state and receipt lookup, with no blind second POST.
- Pending/expired purchases cannot enter the sync worker. Accounting failure does not reverse the paid order or release its inventory.

### Sandbox setup verified, October 2

The Development redirect URI was registered and OAuth completed successfully for **Sandbox Company US a37d**. The code verified the returned realm against the configured sandbox ID, exchanged the authorization code, and stored encrypted tokens in the isolated development database. A real sandbox CompanyInfo read returned HTTP 200. US/USD preferences were confirmed.

With the user's authorization, four missing sandbox records were created and their IDs saved only in ignored `.env.local`: customer **Gala Sandbox Sales**, service item **Symphony Ball**, income account **Symphony Ball Revenue** (Income / OtherPrimaryIncome), and **Stripe Clearing - Gala Sandbox** (Other Current Asset / OtherCurrentAssets). The actual `SandboxQuickBooks.verifyMapping` check passed against Intuit, including the item's income-account reference. These are development mappings, not approved production bookkeeping settings.

### First actual sandbox receipt and retry test, October 2

With explicit user authorization, sandbox syncing was temporarily enabled and the existing fictional Gold table plus two extra seats order (`033779df-9a3d-45ac-914c-dbb2d5dc42a4`) was sent through the local sync API. The worker rechecked the successful Stripe test payment and created QuickBooks sandbox SalesReceipt **145**: **$4,375 USD**, dated **2026-10-02**, with one **Symphony Ball** sales line. A fresh provider lookup verified the receipt against the frozen payload, including customer, clearing account, date, amount and zero sandbox tax; the item-to-income-account mapping also passed its actual API check.

Two sequential repeats of that same sync request each returned HTTP 200 / `busy_or_synced`. Another independent QuickBooks lookup still found exactly one matching receipt, ID 145. The outbox remained `synced` with one worker attempt, and both existing test orders remained paid. The $30 gift order is still pending accounting. No buyer was charged again and no invoice or email was sent.

`GALA_QB_SYNC_ENABLED=false` was restored after the controlled test. No live books were changed. This first check proves a normal successful receipt and retries after success; the subsequent gift recovery test below extends that evidence.

### Gift receipt with controlled failures against Intuit, October 2

`scripts/gala-accounting-recovery-smoke.mts` exercised the real accounting worker, hosted development database and QuickBooks sandbox using the existing paid **$30** gift order (`e0dc2447-5994-47d3-9864-31f980d4acdd`). It revalidated the successful Stripe sandbox payment and accounting mapping before testing. No new charge was made.

1. An injected lookup failure before dispatch left the paid order intact, placed accounting in review and made no receipt POST.
2. The real QuickBooks create request succeeded, but the harness deliberately discarded its response before the worker could record success. The hosted job retained its dispatch marker and entered review. An independent provider lookup found exactly one receipt: **146**, $30 USD, dated **2026-10-02**.
3. On retry, lookup found that receipt; an injected failure at the local success-save step kept the job in review without another receipt POST.
4. An ordinary worker retry recovered receipt 146 by lookup and marked the job synced. Another retry returned `busy_or_synced`. A final provider query still found exactly one receipt, with one **Symphony Ball** line; the harness observed one create call across four worker attempts.

The full paid order, including Sample Student's two roses and one cookie bag, matched its original record after recovery. All table inventory counts were unchanged. The $4,375 table and $30 gift accounting jobs are now synced. The public sync flag remained false throughout this harness test; it invokes the same worker with a separate explicit test opt-in and holds the normal database connection lease. No live books, invoice emails or charges were involved.

These were **controlled application-side fault injections around real sandbox operations**, not actual Intuit downtime, dropped network packets, or a disabled database. They demonstrate the worker's recovery under those injected conditions. Subsequent refresh and local process-termination tests are described below; broader payment races, actual hosted outages, fee/payout posting and treasurer review remain open. All 11 accounting regression tests passed again; the new smoke script passed a dedicated TypeScript check.

To run this one-shot test against another explicitly authorized, fresh paid sandbox gift order, set `NODE_ENV=development` and `GALA_QB_RECOVERY_TEST=true`, then run:

```sh
node --env-file=.env.local --import tsx scripts/gala-accounting-recovery-smoke.mts <paid-gift-order-uuid>
```

It refuses jobs that already entered accounting. Do not reset dispatch markers or replay this against receipt 146; inspect and recover any interrupted run using the normal lookup-only worker.

### Token refresh, process interruption and fee evidence, October 2

- `scripts/gala-qb-refresh-smoke.mts` passed an **actual Intuit sandbox refresh** through the existing `qbAccessToken` path. The harness presented an expired access-token timestamp in memory, without first overwriting the saved connection. Under the normal connection lease, new credentials were encrypted and persisted, API mapping reads succeeded with the refreshed token, and the next normal call reused that token without another refresh. No secret values were printed. Run with local development settings and the explicit `GALA_QB_REFRESH_TEST=true` opt-in.
- `tests/gala-accounting-crash.test.mjs` starts a real child worker using a disk-backed disposable PGlite database and the production SQL/worker, then terminates it with SIGKILL at two dispatch boundaries. On restart, active leases block another worker. After **simulating elapsed lease time in that local database only**, a saved fake-provider receipt is recovered by lookup; a dispatched job with no provider receipt remains in review without another POST. Paid state is retained and the old worker owner cannot finalize the job. This is real process termination with a fake provider and simulated lease expiry, not a hosted Intuit crash test. Both scenarios pass, bringing `npm run test:gala` to **35 passing tests**.
- `scripts/gala-fee-audit.mts` reads all paid development orders with pagination, verifies their Stripe payments and linked balance transactions, rejects refunds/disputes/mismatched amounts, and reports missing fees as unknown rather than zero. It performs no payment, payout or accounting writes. The actual read-only sandbox run found two orders: **$4,405.00 gross, $128.80 fees, $4,276.20 net**. Gold: $4,375 gross / $127.18 fee / $4,247.82 net. Gifts: $30 gross / $1.62 fee / $28.38 net. Both balance transactions were pending; no sandbox payout existed. These are sandbox evidence, not a quote for OSG's eventual live rates, available funds, or a completed bank reconciliation.

Fee/payout work still needs an approved QuickBooks fee-expense account and bank/deposit account, a decision about who owns bank-feed matching, and a tested source of payout membership. Keep the existing gross Symphony Ball sales separate from fee expense and payout movements; never record a payout as a second sale. Stripe's balance transactions supply amount/fee/net, and the payout filter applies to automatic payouts only: [Stripe balance transactions](https://docs.stripe.com/api/balance_transactions/list). Support for a payout must verify the whole payout, including non-Gala adjustments or other sales, rather than equating the two test orders' net total with a bank deposit. Payout failure/reversal and duplicate-safe accounting writes remain unimplemented. No fee or payout entries were sent to QuickBooks.

The refresh and fee-audit scripts passed dedicated TypeScript checks. Sandbox receipt sync remains disabled; all production release gates remain in force.

### Setup procedure (steps 1–4 completed locally)

The existing **OSG Belles & Beaux** app is marked **In Production**. That release label does not eliminate its Development credentials. Use **Keys and credentials → Development** in the Intuit Developer portal, then locate/create a separate sandbox company. [Intuit credential instructions](https://developer.intuit.com/app/developer/qbo/docs/get-started/get-client-id-and-client-secret).

1. Register `http://localhost:3000/api/gala/quickbooks/callback` among the app's **Development** redirect URIs. Leave Production settings unchanged.
2. Save its Development client ID/secret and sandbox company ID in ignored `.env.local` as `GALA_QB_CLIENT_ID`, `GALA_QB_CLIENT_SECRET`, `GALA_QB_REALM_ID`. Empty slots have been prepared locally. `GALA_QB_ENVIRONMENT=sandbox`, a new random encryption key, and `GALA_QB_SYNC_ENABLED=false` are already set. Never paste secrets into chat.
3. Restart the local server if required, then select **Connect QuickBooks sandbox** in the authenticated local admin and authorize only the designated sandbox company.
4. Inspect that sandbox's customer, product and account records. Select/create explicit sandbox test mappings for `GALA_QB_CUSTOMER_ID`, `GALA_QB_ITEM_ID`, `GALA_QB_INCOME_ACCOUNT_ID`, `GALA_QB_CLEARING_ACCOUNT_ID`. No automatic item-1 default or production account changes.
5. Enable `GALA_QB_SYNC_ENABLED=true` locally only after checking the mappings. Sync one fictional paid order; verify its company, gross amount, date, item/income account and clearing account. Retry and prove exactly one receipt exists. Then repeat for gifts and failure scenarios.

The current sandbox payload uses `TaxCodeRef=NON` purely as a test assumption. It is **not** an exemption determination or production tax setup. Tax treatment, fees, Stripe balance/payout reconciliation, exceptional refunds/disputes, receipt wording and production customer mapping require the treasurer's review. Never connect another Stripe-to-QuickBooks writer for the same sales without deciding which system owns those entries.

### Evidence and limits

The automated tests execute the migration and worker using real local PostgreSQL semantics plus a **fake QuickBooks transport**. They cover one POST across repeated/concurrent workers, lookup recovery after lost responses or database-save failure, unknown dispatch retained for review, immutable company/payload, expired lease rejection, mapping conflicts, encrypted token integrity, denied browser access and local worker termination. TypeScript and production build passed for the implementation. Actual sandbox OAuth/refresh, record/mapping checks, table and gift receipts, normal retries and controlled response-loss/save-failure recovery now pass as described above. Genuine hosted provider/database outages, complete payout reconciliation and production accounting decisions remain unverified. No accounting release gate is complete from these tests alone.

API references: [SalesReceipt](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/salesreceipt), [item-to-income-account mapping](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/Item), [sandbox testing](https://developer.intuit.com/app/developer/qbo/docs/develop/sandboxes?no_link=1).

## Next implementation steps

1. Exercise repeated/out-of-order real events, outage recovery and payment at expiry. Broaden concurrent capacity tests beyond the initial two-request check.
2. Implement durable reconciliation scheduling, operator exception handling, gift cutoff enforcement, ticket/venue limits, free invitation persistence, production access controls and retention. Table assignments and paid-gift status/export workflows now persist in development; production volunteer permissions and workflow acceptance remain pending.
3. Broaden acceptance testing of the locally connected customer forms; preserve the client design preview until approved.
4. Extend the verified QuickBooks sandbox sync with scheduling/operator recovery; confirm posting aggregation/cadence, production mappings, tax treatment, fees and payouts with the treasurer. No refunds is the displayed policy; exceptional corrections and disputes still need handling.
5. Meet every item in `GALA_RELEASE_CHECKLIST.md` before enabling any public sales.

The current dependency audit reports 29 findings (2 low, 7 moderate, 19 high, 1 critical), including an existing Next.js critical finding. No Stripe/Stripe CLI package was listed in the findings. No broad dependency upgrade was included in this feature; a separate dependency review is needed before release.

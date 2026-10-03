# Gala backend development

This is a local, sandbox-only backend on `codex/gala-2027-planning`. It is not enabled on the customer preview or production. The flyer pages retain the browser-only prototype. When the backend is enabled locally, the admin reads the development database and a separate payment-testing page creates actual Stripe sandbox checkouts.

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

`npm run test:gala` now runs 33 tests covering pricing, consent, inventory limits, repeat requests, ambiguous creation, payment matching, duplicate/out-of-order transitions, denied browser database access, signatures, local session authentication, accounting recovery, provider failures and environment guards. Database tests execute the real SQL in ephemeral PGlite PostgreSQL. PGlite alone is not proof of multi-connection concurrency.

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

These were **controlled application-side fault injections around real sandbox operations**, not actual Intuit downtime, dropped network packets, or a disabled database. They demonstrate the worker's recovery under those injected conditions. Process termination/lease expiry, actual token refresh, broader payment races, fees/payouts and treasurer review remain open. All 11 accounting regression tests passed again; the new smoke script passed a dedicated TypeScript check.

To run this one-shot test against another explicitly authorized, fresh paid sandbox gift order, set `NODE_ENV=development` and `GALA_QB_RECOVERY_TEST=true`, then run:

```sh
node --env-file=.env.local --import tsx scripts/gala-accounting-recovery-smoke.mts <paid-gift-order-uuid>
```

It refuses jobs that already entered accounting. Do not reset dispatch markers or replay this against receipt 146; inspect and recover any interrupted run using the normal lookup-only worker.

### Setup procedure (steps 1–4 completed locally)

The existing **OSG Belles & Beaux** app is marked **In Production**. That release label does not eliminate its Development credentials. Use **Keys and credentials → Development** in the Intuit Developer portal, then locate/create a separate sandbox company. [Intuit credential instructions](https://developer.intuit.com/app/developer/qbo/docs/get-started/get-client-id-and-client-secret).

1. Register `http://localhost:3000/api/gala/quickbooks/callback` among the app's **Development** redirect URIs. Leave Production settings unchanged.
2. Save its Development client ID/secret and sandbox company ID in ignored `.env.local` as `GALA_QB_CLIENT_ID`, `GALA_QB_CLIENT_SECRET`, `GALA_QB_REALM_ID`. Empty slots have been prepared locally. `GALA_QB_ENVIRONMENT=sandbox`, a new random encryption key, and `GALA_QB_SYNC_ENABLED=false` are already set. Never paste secrets into chat.
3. Restart the local server if required, then select **Connect QuickBooks sandbox** in the authenticated local admin and authorize only the designated sandbox company.
4. Inspect that sandbox's customer, product and account records. Select/create explicit sandbox test mappings for `GALA_QB_CUSTOMER_ID`, `GALA_QB_ITEM_ID`, `GALA_QB_INCOME_ACCOUNT_ID`, `GALA_QB_CLEARING_ACCOUNT_ID`. No automatic item-1 default or production account changes.
5. Enable `GALA_QB_SYNC_ENABLED=true` locally only after checking the mappings. Sync one fictional paid order; verify its company, gross amount, date, item/income account and clearing account. Retry and prove exactly one receipt exists. Then repeat for gifts and failure scenarios.

The current sandbox payload uses `TaxCodeRef=NON` purely as a test assumption. It is **not** an exemption determination or production tax setup. Tax treatment, fees, Stripe balance/payout reconciliation, exceptional refunds/disputes, receipt wording and production customer mapping require the treasurer's review. Never connect another Stripe-to-QuickBooks writer for the same sales without deciding which system owns those entries.

### Evidence and limits

The automated tests execute the migration and worker using real local PostgreSQL semantics plus a **fake QuickBooks transport**. They cover one POST across repeated/concurrent workers, lookup recovery after lost responses or database-save failure, unknown dispatch retained for review, immutable company/payload, expired lease rejection, mapping conflicts, encrypted token integrity and denied browser access. TypeScript and production build passed for the implementation. Actual sandbox OAuth, record/mapping checks, table and gift receipts, normal retries and controlled response-loss/save-failure recovery now pass as described above. Token refresh, process-crash recovery and genuine provider/database outages remain unverified. No accounting release gate is complete from these tests alone.

API references: [SalesReceipt](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/salesreceipt), [item-to-income-account mapping](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/Item), [sandbox testing](https://developer.intuit.com/app/developer/qbo/docs/develop/sandboxes?no_link=1).

## Next implementation steps

1. Exercise repeated/out-of-order real events, outage recovery and payment at expiry. Broaden concurrent capacity tests beyond the initial two-request check.
2. Implement durable reconciliation scheduling, operator exception handling, gift cutoff enforcement, ticket/venue limits, free invitation persistence, production access controls and retention. Add persistent table assignment and fulfillment/export workflows; the new database admin currently displays purchases and payment state only.
3. Connect the approved customer forms to the backend in a separately authorized test environment; preserve the client design preview until approved.
4. Connect and verify the implemented QuickBooks sandbox sync against actual Intuit responses. Add scheduling/operator recovery; review production mappings, tax treatment, fees and payouts with the treasurer. No refunds is the displayed policy; exceptional corrections and disputes still need handling.
5. Meet every item in `GALA_RELEASE_CHECKLIST.md` before enabling any public sales.

The current dependency audit reports 29 findings (2 low, 7 moderate, 19 high, 1 critical), including an existing Next.js critical finding. No Stripe/Stripe CLI package was listed in the findings. No broad dependency upgrade was included in this feature; a separate dependency review is needed before release.

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
- Exactly one pending accounting-outbox row per paid order under `Symphony Ball`. **No QuickBooks sync worker or external accounting writes yet.**
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

Open `http://localhost:3000/gala/preview/testing` and unlock it with `GALA_DEVELOPMENT_TOKEN` from `.env.local`. Use fictional details and Stripe test cards only. The admin is `http://localhost:3000/gala/preview/admin`. It shows paid orders by default, with separate pending and expired views. Successful sales enter the accounting outbox; QuickBooks is not connected.

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

22 tests cover pricing, consent, inventory limits, repeat requests, ambiguous creation, payment matching, duplicate/out-of-order transitions, denied browser database access, signatures, local session authentication, provider failures and environment guards. Database tests execute the real SQL in ephemeral PGlite PostgreSQL. PGlite alone is not proof of multi-connection concurrency.

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

## Next implementation steps

1. Exercise repeated/out-of-order real events, outage recovery and payment at expiry. Broaden concurrent capacity tests beyond the initial two-request check.
2. Implement durable reconciliation scheduling, operator exception handling, gift cutoff enforcement, ticket/venue limits, free invitation persistence, production access controls and retention. Add persistent table assignment and fulfillment/export workflows; the new database admin currently displays purchases and payment state only.
3. Connect the approved customer forms to the backend in a separately authorized test environment; preserve the client design preview until approved.
4. Implement and review QuickBooks sync, fees and payouts with the treasurer. No refunds is the displayed policy; exceptional corrections and disputes still need handling.
5. Meet every item in `GALA_RELEASE_CHECKLIST.md` before enabling any public sales.

The current dependency audit reports 29 findings (2 low, 7 moderate, 19 high, 1 critical), including an existing Next.js critical finding. No Stripe/Stripe CLI package was listed in the findings. No broad dependency upgrade was included in this feature; a separate dependency review is needed before release.

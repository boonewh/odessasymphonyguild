# Gala backend development

This is a local, sandbox-only backend on `codex/gala-2027-planning`. It is not enabled on the customer preview or production. The existing pages and demo admin still use the browser-only prototype.

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

Keep the backend disabled until the webhook listener is configured. The secret must be the signing secret for that listener, not a Stripe API key. Generate the development token as 32 random bytes encoded in hexadecimal; it protects the manual checkout and reconciliation endpoints and must not be bundled into browser code.

The runtime pins both the development Stripe account and Supabase URL in `lib/gala/backend/config.ts`, checks a development database marker, rejects live keys, and rejects all Vercel environments and `NODE_ENV=production`. These are deliberate development barriers, not the eventual production configuration.

- `POST /api/gala/checkout`: requires `x-gala-development-token`, JSON `requestId` UUID, `kind`, `contact`, `allSalesFinal: true`, and `purchase` or `gifts`. Reuse the same request ID for retries; do not mint a new one after an uncertain response.
- `POST /api/gala/webhook`: requires Stripe's valid signature; accepts Checkout completed/expired/async-success/async-failure events. Unrelated sessions are ignored. Database failures return 500 for delivery retry.
- `POST /api/gala/reconcile`: requires the development token. Does not create replacement checkout sessions.
- `/gala/preview/payment`: neutral return page; a browser redirect never marks an order paid.

Checkout expires 35 minutes after reservation **for development testing only**. Stripe's timed expiration needs at least 30 minutes from session creation; the extra five minutes allows short creation retries. The agreed production checkout window is still undecided. Earlier provider-side expiration was exercised successfully in testing. A scheduled shorter hold has not been implemented.

## Validation performed

```sh
node --import tsx --test tests/gala-backend.test.mjs tests/gala-model.test.mjs tests/gala-client-review.test.mjs
npm run build
```

21 tests cover pricing, consent, inventory limits, repeat requests, ambiguous creation, payment matching, duplicate/out-of-order transitions, denied browser database access, signatures, provider failures and environment guards. Database tests execute the real SQL in ephemeral PGlite PostgreSQL. PGlite alone is not proof of multi-connection concurrency.

Additional checks used the actual Stripe sandbox and hosted development database:

```sh
node --env-file=.env.local --import tsx scripts/gala-stripe-smoke.mts
node --env-file=.env.local --import tsx scripts/gala-hosted-smoke.mts
```

- A real $4,375 test Checkout Session was created; an identical idempotency key returned that same session.
- Two independent hosted RPC requests raced for one temporary Gold table; exactly one obtained the reservation.
- The winning hosted order linked to Stripe; repeat checkout reused the same session. Provider-confirmed expiration released inventory, preserved the expired order, and created no accounting sale.
- The temporary Gold capacity was restored to 20. All three tiers remain **unapproved development placeholders**.
- No card was charged. These checks do **not** prove successful payment, real webhook delivery, browser payment-at-expiry races, refunds, bank payouts or accounting correctness.
- The production build passed. With `GALA_BACKEND_ENABLED=true` deliberately set, HTTP POST requests to all three new backend endpoints still returned 404 under the production server.

The hosted smoke script changes development Gold capacity temporarily and keeps its audit record. Only run it while no other Gold reservations are active. It refuses a different project or Stripe account.

## Next implementation steps

1. Configure Stripe CLI webhook forwarding to local `/api/gala/webhook`, save its signing secret, and generate the local endpoint token.
2. Add an isolated local payment-testing UI and connect the real order store to authenticated Gala administration. Preserve the client design preview until approved.
3. Exercise hosted test-card success, decline, authentication, repeated/out-of-order real events, outage recovery and payment at expiry. Broaden concurrent capacity tests beyond the initial two-request check.
4. Implement durable reconciliation scheduling, operator exception handling, gift cutoff enforcement, ticket/venue limits, free invitation persistence, access controls and retention.
5. Implement and review QuickBooks sync, fees and payouts with the treasurer. No refunds is the displayed policy; exceptional corrections and disputes still need handling.
6. Meet every item in `GALA_RELEASE_CHECKLIST.md` before enabling any public sales.

Dependency installation also reported existing dependency audit findings (22 total, including one critical). No broad dependency upgrade was included in this feature; a separate dependency review is needed before release.

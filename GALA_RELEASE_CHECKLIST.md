# Gala sales: launch is blocked

User instruction, September 28, 2026: keep this feature away from live until ready and tested. Firm inventory numbers are required. A generic request to push or publish does not waive this requirement.

## Current local preview

Run `npm run dev` and open:

- `/gala/tables`: table tiers, ticket choices, extra seats, buyer details, no-refund acknowledgment.
- `/gala/gifts`: multiple student recipients, roses and cookie bags, buyer details.
- `/gala/invitations`: multiple mailing recipients and requester details.
- `/gala/preview/admin`: sample orders, inventory, paid/unpaid filters, table assignment, gifts and mailing statuses.

Use fictional data only. Flyer-page prototype orders are stored in this browser under `osg-gala-local-preview-v1`. These forms send no information to Stripe, Supabase, QuickBooks, the Guild, or an email provider. When `GALA_BACKEND_ENABLED=true` locally, `/gala/preview/admin` instead displays the isolated development database, and `/gala/preview/testing` makes actual sandbox purchases. See `GALA_BACKEND_DEVELOPMENT.md` for that separate workflow. No production admin is implemented.

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
- [ ] Review and resolve applicable dependency security findings, including the current Next.js critical advisory.

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

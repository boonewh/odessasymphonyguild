# Gala sales: launch is blocked

User instruction, September 28, 2026: keep this feature away from live until ready and tested. Firm inventory numbers are required. A generic request to push or publish does not waive this requirement.

## Current local preview

Run `npm run dev` and open:

- `/gala/tables`: table tiers, ticket choices, extra seats, buyer details, no-refund acknowledgment.
- `/gala/gifts`: multiple student recipients, roses and cookie bags, buyer details.
- `/gala/invitations`: multiple mailing recipients and requester details.
- `/gala/preview/admin`: sample orders, inventory, paid/unpaid filters, table assignment, gifts and mailing statuses.

Use fictional data only. Preview orders are stored in this browser under `osg-gala-local-preview-v1`. Clear them in the preview admin. No information is sent to Stripe, Supabase, QuickBooks, the Guild, or an email provider. This is not a production admin or secure persistent order store.

`requireGalaPreview()` requires local development and rejects any Vercel environment. All four routes return 404 in production. This code guard is intentionally stricter than an environment toggle. Do not remove it until the checklist below is complete and launch is authorized.

## Mandatory release gates

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

No launch date is currently authorized. No live integration or end-to-end payment tests are complete.

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

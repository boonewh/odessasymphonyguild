# Project working agreements

- For small, ordinary updates, work on `main` unless the user requests otherwise. Use feature branches for involved work.
- Gala sales, table inventory, Stripe integration, and the new Gala admin are involved work. Continue on the Gala feature branch and keep it off `main` and production until the release requirements are met.
- Read `GALA_2027_PLAN.md` and `GALA_RELEASE_CHECKLIST.md` before changing or releasing the sales feature.
- **October 19 board decision, relayed by the user: Platinum, Gold, and Silver table sales are unlimited.** Use explicit unlimited capacity (NULL), not a fake large stock number. Retain optional finite limits and unpaid-checkout expiration. The old 20-per-tier quantities were development placeholders and are superseded. This policy decision does not authorize production launch.
- Gala bookkeeping is manual: Britni handles Stripe payouts and QuickBooks entry. Keep the item ledger and exports; do not reconnect Gala to QuickBooks or send totals without a new user decision. Leave the separate membership QuickBooks integration untouched.
- Admin access policy: the user chooses one shared password for Dues and Gala, with a landing page and a future Patron section. Will manages the password through 2027. Do not require individual volunteer accounts or separate ledger permissions without a new decision. Keep test rosters isolated from live membership records; production rollout still requires authorization.
- No Gala sales launch until meaningful payment/inventory tests pass and launch is explicitly authorized. Do not treat a request to push a feature branch as authorization to merge or deploy it to production.
- October 20: the user accepts January 29, 2027 for gift orders and explicitly says the remaining operating questions are not launch blockers. Keep current behavior while those follow-ups are deferred; do not require new OSG answers to continue. Technical payment/access checks and explicit production release authorization still apply.
- Online card payments through Stripe are settled scope, not an open question. The existing website Contact section is the approved buyer-help destination. OSG handles correction requests when contacted; anyone with the shared password may use the existing admin tools. Do not require a named correction approver or propose more payment methods without a new request.
- Current Gala venue wording: La Hacienda. Current policy: all sales final, no refunds. Both may be revised only following a new user decision.
- Keep attached conversation screenshots and local credentials out of Git.
- October 20 database decision: install Gala's separate `public.gala_*` objects in the existing production membership database; keep development/test separate. Preserve Dues records, schema, grants and shared default privileges. Adapting/testing the installer locally is authorized; applying it to production or launching still requires explicit authorization.
- October 20 subsequent authorization: the user explicitly authorized applying the production installer and configuring live services, with sales closed until separately activated. The shared production installation, eight production-only Vercel Gala variables, disabled live webhook and inactive recovery schedule are now staged and verified; see `supabase/gala-production/STAGED_SETUP.md`. No application release, main merge or sales activation was performed. Do not rerun the one-time installer or mistake staged services for verified end-to-end production delivery.
- October 20 deployment authorization: the user explicitly authorized deploying the application and verifying payment notifications/recovery. The routing release gate may be enabled for that deployment. Keep `gala_operating_state.sales_open=false` and `invitations_open=false` until explicit activation; do not equate the routing/configuration flags with sales approval. Deploy from the Gala branch; no main merge is required.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

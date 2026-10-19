# Project working agreements

- For small, ordinary updates, work on `main` unless the user requests otherwise. Use feature branches for involved work.
- Gala sales, table inventory, Stripe integration, and the new Gala admin are involved work. Continue on the Gala feature branch and keep it off `main` and production until the release requirements are met.
- Read `GALA_2027_PLAN.md` and `GALA_RELEASE_CHECKLIST.md` before changing or releasing the sales feature.
- **October 19 board decision, relayed by the user: Platinum, Gold, and Silver table sales are unlimited.** Use explicit unlimited capacity (NULL), not a fake large stock number. Retain optional finite limits and unpaid-checkout expiration. The old 20-per-tier quantities were development placeholders and are superseded. This policy decision does not authorize production launch.
- Gala bookkeeping is manual: Britni handles Stripe payouts and QuickBooks entry. Keep the item ledger and exports; do not reconnect Gala to QuickBooks or send totals without a new user decision. Leave the separate membership QuickBooks integration untouched.
- Admin access policy: the user chooses one shared password for Dues and Gala, with a landing page and a future Patron section. Will manages the password through 2027. Do not require individual volunteer accounts or separate ledger permissions without a new decision. Keep test rosters isolated from live membership records; production rollout still requires authorization.
- No Gala sales launch until meaningful payment/inventory tests pass and launch is explicitly authorized. Do not treat a request to push a feature branch as authorization to merge or deploy it to production.
- Current Gala venue wording: La Hacienda. Current policy: all sales final, no refunds. Both may be revised only following a new user decision.
- Keep attached conversation screenshots and local credentials out of Git.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project working agreements

- For small, ordinary updates, work on `main` unless the user requests otherwise. Use feature branches for involved work.
- Gala sales, table inventory, Stripe integration, and the new Gala admin are involved work. Continue on the Gala feature branch and keep it off `main` and production until the release requirements are met.
- Read `GALA_2027_PLAN.md` and `GALA_RELEASE_CHECKLIST.md` before changing or releasing the sales feature.
- **20 tables per tier is development placeholder inventory, not approved stock. Do not launch without firm board-confirmed quantities.** The user explicitly requested enforcing this even if they casually ask to go live later. Explain the unmet requirement and stop a premature release.
- No Gala sales launch until meaningful payment/inventory tests pass and launch is explicitly authorized. Do not treat a request to push a feature branch as authorization to merge or deploy it to production.
- Current Gala venue wording: La Hacienda. Current policy: all sales final, no refunds. Both may be revised only following a new user decision.
- Keep attached conversation screenshots and local credentials out of Git.

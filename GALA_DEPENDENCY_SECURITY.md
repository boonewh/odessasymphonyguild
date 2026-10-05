# Dependency security review — October 4, 2026

Development branch: `codex/gala-2027-planning`. No merge, deployment, live OAuth authorization, charge or accounting write was performed. This is a dependency review, not a complete application security audit.

## October 5 closeout and scope separation

The Gala MVP retains the compatible dependency updates and callback-parser mitigation, with **100 Gala tests, 3 OAuth SDK tests and the build passing**. The membership state-validation implementation, migration and seven tests are preserved on local branch `codex/membership-oauth-hardening` at `14803d4`; they are absent from the current Gala checkout. No new shared-database migration is required to run this MVP. No hosted membership migration or fresh OAuth authorization was performed.

This separation preserves the existing membership flow apart from callback normalization. Its previously identified state-validation gap is **not fixed in the current Gala checkout** and must be handled as separate membership security/release work. Do not present the three decoder tests as proof of membership CSRF/replay protection. The historical membership section below describes the implementation on the preserved branch. The remaining dependency findings also remain production release considerations; neither this review nor the local MVP authorizes launch.

## Result

`npm audit` decreased from 29 affected packages (one critical, 19 high, seven moderate, two low) to **10 affected packages (seven high, three moderate)**. Those ten entries represent two underlying advisory chains, including their dependent packages. The security release gate remains open.

Compatible updates were installed, followed by `npm audit fix` without `--force`. Key installed versions:

| Package | Before | After |
| --- | --- | --- |
| next | 16.1.0 | 16.3.8 |
| eslint-config-next | 16.0.7 | 16.3.8 |
| intuit-oauth | 4.2.2 | 4.2.5 |
| axios (transitive) | 1.13.2 | 1.20.0 |
| postcss (direct) | 8.5.6 | 8.5.28 |
| tailwindcss | 3.4.18 | 3.4.19 |

Next.js critical advisories are no longer reported, including [Windows path traversal](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) and [the AVIF advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4). The ignored `.codex-remote-attachments/audit-before.json` and `audit-after.json` preserve local audit evidence; they are not deliverables to commit.

## Remaining findings

- **braces: high, seven package entries.** [Nested-pattern stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) remains through Tailwind and Next ESLint tooling (`chokidar`, `micromatch`, `fast-glob`). Current Tailwind patterns are fixed repository configuration; no application runtime import was found. This narrows the observed exposure but does not resolve the dependency finding. No compatible fixed braces release was available in this review. Track upstream fixes or separately test a tooling migration; do not apply the audit's forced Tailwind major upgrade or Next ESLint downgrade blindly.
- **decode-uri-component: moderate, three package entries.** [Decoder denial of service](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) remains through `query-string` and `intuit-oauth`. The [0.5.0 decoder release](https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.0) uses ESM; the SDK's query-string version expects a CommonJS function, so a raw override is incompatible. `lib/quickbooks/oauth-callback.ts` now bounds callback length and field sizes, rejects duplicate token fields and canonicalizes only code, realmId and state through native URL parsing before every application `createToken` call. Malformed percent escapes and untrusted redirectUri overrides do not reach the SDK parser. This mitigates the identified input path; it does not remove the vulnerable dependency. Adopt a compatible upstream SDK/parser fix when available and rerun the tests.

## Validation and limits

- `npm run test:gala`: **79 passed**.
- `npm run test:security`: **10 passed** after the OAuth state follow-up below. Three tests exercise the installed Intuit SDK with a stubbed token transport; seven exercise authorization handlers against the actual new SQL in disposable PGlite databases. No actual OAuth token exchange was performed.
- `npm run build`: passed, including TypeScript. Existing middleware/Edge-runtime deprecation and metadataBase warnings remain; no migration was attempted here.
- Local production-mode server: homepage 200; Gala tables, gifts, invitations, admin, invitation labels/PATCH, checkout/webhook POST, recovery GET/POST and Gala OAuth callback all 404.
- Local development server and sandbox recovery worker restarted successfully; first recovery pass checked zero orders. These remain foreground processes, not reboot-persistent services.

## Membership OAuth state follow-up (preserved on separate branch)

The earlier review found that membership authorization generated state without persisting or validating it. The development branch now fixes this flow separately from Gala OAuth. It follows Intuit's requirement to validate returned state against the initiating authorization attempt ([Intuit OAuth documentation](https://developers.intuit.com/app/developer/qbpayments/docs/develop/authentication-and-authorization/oauth-2.0)).

- An authorized start generates independent 256-bit state and browser-binding secrets. Only their SHA-256 hashes and a hash of the configured client/environment/redirect URI are stored. A callback-scoped HttpOnly/SameSite=Lax cookie carries the browser binding for ten minutes; HTTPS uses Secure. The request origin must match the configured callback origin. HTTP is accepted only on localhost/127.0.0.1.
- The server checks state, browser binding, configuration and database-enforced expiry, then atomically deletes the matching attempt before any token exchange. Parallel requests and retained-cookie replays cannot reuse it. Declines, malformed callbacks and exchange/save failures require a fresh authorization start. Callback responses clear the cookie; initiation and callback responses prevent caching/referrer leakage and use explicit 302 redirects. Provider exceptions containing secrets are not logged.
- Unconfigured/empty admin authentication fails closed. The existing password-in-query initiation interface is preserved for compatibility; replacing it with the application's authenticated admin session remains a separate access-control improvement. No additional OAuth scopes were requested.
- `supabase/migrations/20261004180000_qb_oauth_attempts.sql` adds the private state table and service-only issue/consume functions. Browser roles cannot access either; even service-role direct table access is revoked. The adapter requires the service credential and never falls back to a browser key. Expired records are pruned on the next authorized issuance.
- **The migration has been tested only in disposable local databases. It has not been applied to any hosted database.** Before an authorized release of these shared membership routes, apply and verify the migration in the intended environment, then complete a fresh sandbox OAuth authorization test. Missing migration/storage returns 503 at initiation and rejects callbacks before exchange. Existing stored tokens are untouched.
- Seven new tests cover unauthorized starts, hashed storage/cookie flags, missing/wrong/duplicate/cross-browser state, changed configuration, simultaneous/replayed callbacks, server expiry, decline/malformed/failure handling, unavailable storage and database permissions. PGlite provides local SQL verification; it is not an independent hosted-connections test.
- Build passed. Local HTTP smoke checks returned 401/no-store for unauthorized initiation and 302/error with cookie deletion/no-referrer for an invalid callback. No live account or credential was used for a valid authorization, and no token, payment or accounting record was written.

Continue the deeper payment/recovery review and remaining acceptance tests. Production access, accounting decisions and all other release gates remain open. **20 tables per tier is unapproved development inventory.**

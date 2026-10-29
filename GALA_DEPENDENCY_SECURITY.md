# Dependency security review

## October 28: framework and compatible dependency upgrade

The upgrade branch starts from the current Gala/Patron application at `9c414b1`, not old `main`. Next.js and eslint-config-next are 16.4.3; React/React DOM remain on the 19.2 minor at 19.2.9; Zod is 4.6.7. Compatible Supabase, form, Stripe and build/test-tool patches/minors are recorded in the lockfile. Local verification uses the checksum-verified Node 24.22.1 binary; `.nvmrc` and `.node-version` pin that version and `engines.node` selects Node 24 on supported hosting. The machine-wide Node installation is unchanged.

The approved fresh npm audit decreased from **5 affected package entries (1 critical, 1 high, 3 moderate)** to **3 moderate entries, 0 high, 0 critical**. The remaining entries are one chain: `intuit-oauth` → `query-string` → `decode-uri-component`. npm reports no compatible fix for it. Preserve the existing bounded/native callback normalization and SDK-level decoder tests. This is not a clean-audit or full application-security claim; npm audit does not cover the runtime itself or source-level authorization issues.

**Dues scope:** the user reaffirmed that the entire Dues flow will be rebuilt with Stripe before more Dues are collected. Leave its existing QuickBooks routes, tokens, roster, schema and permissions unchanged. The known OAuth state-validation gap belongs to that rebuild/retirement. The candidate OAuth hardening and migration were excluded from this upgrade; no database change is required or applied.

### Compatibility changes

- Supabase 2.118 enables automatic transient retries. Existing tests caught a stalled request being retried, extending the intended database deadline. The Gala and Patron adapters explicitly use `db.retry=false` so existing idempotent checkout/recovery logic continues owning retries. The original stalled-header/partial-body/committed-claim tests pass without relaxing their assertions.
- ESLint uses its CLI and flat config instead of removed `next lint`. Fixes include JSX text escaping, supported internal links and explicit types. Existing mount effects that hydrate browser storage/start asynchronous reads retain visible performance warnings in the named components; hook ordering/dependency checks remain enabled. ESLint remains on 9.39.5 because the installed React/accessibility plugins declare peers only through ESLint 9; forcing ESLint 10 would break the supported dependency graph. Its upstream support status remains a maintenance limitation.
- The payment-recovery panel samples time from a timer into state rather than calling `Date.now()` during render. Heartbeat age and retry-lease availability update every five seconds; server-side lease/payment checks remain authoritative.
- Zod boundary tests cover oversized invalid cart/invitation/guardian collections and ordinary checkout limits. Existing price, idempotency, settlement, privacy and database-permission suites remain the payment acceptance criteria.

Local/hosted validation and release status are recorded in `UPGRADE_2026-10-28.md`. Older dated sections below are historical and do not describe the current audit count or reopen the deferred Dues work.

Authorized release completed: application `a5631ed` is live as `dpl_EYdcVqdYc89ZZASBacD7bq8DbitW`, confirmed on Node 24.x. 205 local tests, build/types/lint, 36 built-app HTTP checks, 38 hosted checks and 10 live desktop/mobile page checks pass. Webhook/flags, unlimited inventory, admin/roster access and advancing automatic recovery are preserved. No database/Dues change or real order/charge was made. The three moderate Intuit-chain entries remain documented; this is not a zero-findings claim.

## October 20: release dependency review completed with recorded residual findings

This is the current dependency-review result. It supersedes the October 19 instruction to investigate the 13-entry audit. It is not a full application security audit or production launch approval. No provider settings, deployed application or membership behavior changed.

### Applied compatible fixes

Only two transitive versions changed in `package-lock.json`; direct framework/payment dependencies and `package.json` are unchanged. Installed with `npm update <package> --ignore-scripts`, without a forced bulk fix, overrides or a framework migration.

| Package | Before | After | Evidence |
|---|---|---|---|
| source-map-js | 1.2.1 | **1.2.2** | [Maintainer release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) fixes the indexed-source-map denial of service; the npm finding disappears. |
| postcss-selector-parser | 6.1.4 | **6.1.5** | [Maintainer security advisory](https://github.com/postcss/postcss-selector-parser/security/advisories/GHSA-rj75-hqrm-r3gf) explicitly lists **6.1.5** and 7.1.6 as patched. The 6.x backport satisfies the existing Tailwind/postcss-nested ranges. |

The final npm report still lists **12 affected package entries: 7 high, 5 moderate, 0 critical**. These are dependency-chain entries, not twelve independently demonstrated application vulnerabilities. The npm/GitHub aggregate advisory range still flags selector-parser versions below 7.1.6, including the maintainer-confirmed 6.1.5 backport; preserve this discrepancy rather than forcing a 7.x override or claiming a clean audit. A bounded local 20,000-class selector fixture round-tripped unchanged in 22 ms on 6.1.5.

### Residual exposure and disposition

- **braces 3.0.3 (seven high entries through Tailwind/ESLint):** no compatible patched release is published in the registry at this review. The [reported recursion issue](https://github.com/micromatch/braces/issues/70) requires attacker-controlled nested brace patterns. This repository's Tailwind content globs and CSS are fixed source/configuration; source inspection found no buyer/admin request path passing submitted patterns to these build tools. Retain the current compatible tooling and track an upstream fix. Do not accept user-uploaded patterns/CSS into build processing without reassessing this risk. The audit's suggested Tailwind major upgrade/Next ESLint downgrade is not an appropriate automatic release fix.
- **postcss-selector-parser/postcss-nested (two moderate entries):** patched locally to the maintainer-listed 6.1.5 backport, despite the aggregate audit warning. Its [maintainer advisory](https://github.com/postcss/postcss-selector-parser/security/advisories/GHSA-rj75-hqrm-r3gf) also distinguishes untrusted request-time selectors from ordinary trusted build-time use. No submitted-selector processing was found in this app.
- **decode-uri-component via query-string/intuit-oauth (three moderate entries):** retained for the separate membership QuickBooks integration. The [maintainer advisory](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr) identifies a malformed-input CPU-exhaustion issue and a patched 0.5.0 release. The current SDK uses the older CommonJS chain; no compatible SDK fix is reported. Both repository `createToken` callers already pass through `oauthCallbackForTokenExchange`, which bounds the callback, parses natively and re-encodes only allowed fields before the legacy decoder runs. Existing SDK-level tests cover malformed encodings, size/duplicate-field rejection and token-field preservation. Retain that mitigation; no raw callback may be passed to `createToken` in a future change. Gala QuickBooks endpoints remain retired. Do not remove the membership SDK or claim its broader OAuth security is solved.

The previously documented membership OAuth state-validation gap remains separate and unchanged; its preserved branch is described below. Decoder tests are not proof of CSRF/replay protection. The residual dependency findings above are documented maintenance risks for this architecture, not new OSG operating questions. Reassess when upgrading tooling/SDKs or adding any new parser input path.

Validation: **175 Gala tests**, **3 existing OAuth SDK tests**, the production build and **82 built-app Preview/production HTTP checks** pass. All three generated CSS files have identical content hashes before and after the patches. The 20,000-class selector fixture also preserves its input. No test payment, hosted database write or deployment was performed.

Local evidence (ignored, not committed): `.codex-remote-attachments/gala-release-audit.json`, `gala-release-audit-final.json`, `gala-dependency-tree.txt`, and the dependency build/test logs. Deployment traces alone were not used as proof of non-reachability because dependencies can be bundled into server chunks.


## October 19: production preparation audit refresh

Read-only `npm audit --json` against the current lockfile reports **13 affected package entries: 8 high, 5 moderate, 0 critical**. This supersedes the older count below; it is a dependency report, not a count of independently exploitable application flaws. No package was changed during this payment-preparation pass. The private report is `.codex-remote-attachments/live-preparation-audit.json`.

Reported chains include the existing braces/Tailwind/ESLint tooling and Intuit decoder chains, plus source-map-js and selector-parser/postcss-nested entries. The audit advertises compatible fixes for some entries, but also suggests a Tailwind major migration and an ESLint-config downgrade; do not run a forced bulk fix. Review actual dependency paths and runtime exposure, apply appropriate fixes, and re-run build/security checks as part of the existing production security gate. Keep the membership Intuit dependency while its separate integration remains in use. This audit does not clear that gate.

## October 4 review

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

# Gala live setup and closed-sales deployment — October 20, 2026

The user authorized installing the database and configuring live services, then explicitly authorized deployment and verification with sales closed. Application commit **`db3ff7d`** is deployed at **https://www.odessasymphonyguild.org**. No main merge or sales activation occurred.

Deployment: `dpl_2BJeyCdFEx67L22YqBBPqFaVXfme`, URL `https://odessasymphonyguild-3xynhxx6y-boonewhs-projects.vercel.app`. The upload was a Git archive of the tested commit, excluding local credentials and evidence. Production routing is enabled; database sales and invitation flags are still false.

## Verified setup

| Component | Actual state |
| --- | --- |
| Database | Existing Odessa Symphony Guild membership project `uhfxkdzhpyzuwkvmners`; development stays separate |
| Installer | `001_initial.sql`, SHA-256 `677C1DDD0101FDDFDD28EF57646E4BF67A5951F7C7869204DE9AF3518105C345` |
| Backup | Dashboard showed daily physical backups; latest inspected October 19, 2026 07:49:22 UTC. No restore drill performed |
| Membership | Before/after record fingerprints unchanged: 120 students, 6 settings, 2 interests and 100 existing token records; all 97 column descriptors match |
| Membership permissions | Exact schema/grant fingerprint match after installation. Enabling cron adds defaults in its new schema; excluding only new cron/net schema defaults restores the exact original fingerprint |
| Gala | Production marker, empty business tables, three board-confirmed unlimited tiers, RLS/private grants; `sales_open=false`, `invitations_open=false` |
| Database API | Actual service-role reads pass, including 120 Dues rows; browser table and RPC reads denied |
| Stripe | OSG `acct_1UPo5fKdKFOoaTnc`; charges and payouts enabled; payout schedule `manual` |
| Key | Restricted live key using the user-selected One-time payments template. Broader than the app's minimum permissions; narrowing deferred. No key values in Git |
| Webhook | `we_1USWQsKdKFOoaTnccPHWbXKr`, **enabled**, canonical `/api/gala/webhook`; actual Stripe delivery 200 |
| Recovery | `gala-live-payment-recovery`, every minute, **active**; scheduled HTTP 200 and advancing heartbeat verified |
| Public site | Homepage and Gala pages 200; code-free buyer session works; checkout and invitations reject submissions while closed |

The restricted account response did not return bank details or a requirements list. Do not interpret missing fields as bank verification or an empty requirements list. No real charge, checkout, refund or payout was created.

## Vercel Production

Project `odessasymphonyguild`, team `boonewhs-projects`. All eight settings are production-only; Preview sandbox values were not changed:

- `GALA_LIVE_ENABLED=true` — routing/processing enabled, not permission to open database submission flags
- `GALA_LIVE_ORIGIN=https://www.odessasymphonyguild.org`
- `GALA_LIVE_SUPABASE_URL=https://uhfxkdzhpyzuwkvmners.supabase.co`
- `GALA_LIVE_SUPABASE_SECRET_KEY` — secret
- `GALA_LIVE_STRIPE_SECRET_KEY` — secret
- `GALA_LIVE_STRIPE_WEBHOOK_SECRET` — secret
- `GALA_LIVE_SESSION_SECRET` — independent secret
- `GALA_LIVE_RECOVERY_SECRET` — independent Vault-generated secret

The session secret remains independent of recovery. The recovery value was generated inside Vault under `gala_live_recovery_secret` and copied privately into Vercel. No secret literal was embedded in SQL history. Browser roles cannot read Vault. Production deployment consumed these settings; Preview credentials and deployment were not changed.

Webhook subscriptions: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`. No Vercel Preview bypass is used on the live destination.

## Verification evidence

Private, ignored directory `.codex-remote-attachments/live-setup/` contains:

- `membership-before.json`, `membership-after.json`, `membership-final.json`, `membership-normalized-final.json`
- `installation-result.json`, `closed-final.json`, `hosted-verification.json`
- `stripe-verification.json`, `recovery-verification.json`, `vercel-production-metadata.json`

Other files there contain credentials; never attach or commit the directory. Supabase CLI local `.temp` state is also ignored.

Initial setup verification: 13 production-database/access tests and SQL reproducibility passed. For this routing release, the full **177 Gala tests, 3 membership OAuth tests, production build and 82 built-app Preview/disabled-production HTTP checks passed**. Vercel's production build also passed.

Hosted acceptance passed **44 HTTP checks**: public live wording, private code-free buyer sessions, unauthorized/CSRF denial, shared admin login, Dues redirect/roster/pricing, Gala administration/read APIs, empty recovery pass, sign-out, closed checkout and closed invitation submissions. Actual Dues API returned all 120 records. No membership writes were performed. Final membership fingerprints/columns/existing grants remain equal to the pre-installation baseline; Gala business tables remain empty.

Webhook verification:

- Invalid signature, sandbox event and connected-account event were rejected with 400.
- A correctly signed irrelevant fixture was acknowledged twice with 200. A signed “paid” fixture referring to a nonexistent Checkout Session returned 500 for retry, without changing the ledger; the embedded claim was not trusted.
- Actual Stripe event `evt_1USNBnKdKFOoaTncWd031GQe` (`account.updated`) was resent after briefly adding that event to the subscription. Vercel recorded **200 at 06:39:24.753 UTC**, user agent `Stripe/1.0 (+https://stripe.com/docs/webhooks)`. The four payment-only subscriptions were restored and verified. The earlier attempt without the extra subscription was not counted as delivery proof.
- This establishes actual provider delivery/signature handling without creating a real payment. Actual paid-order settlement remains covered by prior sandbox and offline acceptance; monitor the first genuine live purchase.

Recovery verification:

- Unauthenticated/wrong-secret invocations returned 401; the authorized empty pass returned `{"checked":0}`.
- Supabase cron then independently called the endpoint at **06:38, 06:39 and 06:40 UTC**, each with HTTP 200 (`pg_net/0.20.0` in Vercel request records). SQL job history, HTTP response body and advancing `gala_recovery_worker.last_poll_at` confirm execution, not merely enqueueing.
- Keep recovery and webhook processing enabled while new sales are closed.

Additional private evidence: `deployment-db3ff7d.json`, `release-http-verification.json`, `provider-subscribed-resend.json`, `provider-delivery-status.json`, `release-request-logs-final.jsonl`, `recovery-live-verification.json`, `post-deploy-closed.json`, `membership-post-deploy.json`, `release-tests.log`, `release-build.log`. Logs/evidence remain ignored; do not publish account data or credentials from that directory.

## Remaining activation

The application is deployed and the requested hosted acceptance is complete. **Wait for explicit user activation approval.** Then open only the approved database submission flags, verify buyer availability and monitor the first genuine purchase/ledger entry. No further OSG business answers are required by this release.

`LIVE_RELEASE_APPROVED=true` and `GALA_LIVE_ENABLED=true` enable routing and processing. They do not bypass `gala_operating_state.sales_open=false` or `invitations_open=false`. Preserve this distinction in future work.

The previous production deployment was `odessasymphonyguild-7dl8jujp0-boonewhs-projects.vercel.app`, source `66449e8`. It lacks the new live processing and is **not a suitable post-sales rollback**. The feature branch remains ahead of main; a later production deploy must retain this release and its payment handlers. Do not accidentally redeploy old main over it.

For a post-launch pause, close new sales/invitations while preserving webhook/recovery processing for already-issued payments. Do not disable settlement as a routine pause, delete paid records or restore the whole shared database to undo a Gala change.

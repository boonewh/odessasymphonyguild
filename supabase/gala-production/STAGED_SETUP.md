# Gala live setup — October 20, 2026

The user authorized installing the database and configuring live services while keeping sales closed until explicit activation. Setup is staged; the production application has not been deployed or merged to main.

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
| Webhook | `we_1USWQsKdKFOoaTnccPHWbXKr`, **disabled**, canonical `/api/gala/webhook` |
| Recovery | `gala-live-payment-recovery`, every minute, **inactive**, zero runs |
| Public site | Homepage 200; unreleased `/api/gala/session` 404 |

The restricted account response did not return bank details or a requirements list. Do not interpret missing fields as bank verification or an empty requirements list. No real charge, checkout, refund or payout was created.

## Vercel Production

Project `odessasymphonyguild`, team `boonewhs-projects`. All eight settings are production-only; Preview sandbox values were not changed:

- `GALA_LIVE_ENABLED=false`
- `GALA_LIVE_ORIGIN=https://www.odessasymphonyguild.org`
- `GALA_LIVE_SUPABASE_URL=https://uhfxkdzhpyzuwkvmners.supabase.co`
- `GALA_LIVE_SUPABASE_SECRET_KEY` — secret
- `GALA_LIVE_STRIPE_SECRET_KEY` — secret
- `GALA_LIVE_STRIPE_WEBHOOK_SECRET` — secret
- `GALA_LIVE_SESSION_SECRET` — independent secret
- `GALA_LIVE_RECOVERY_SECRET` — independent Vault-generated secret

The session secret remains independent of recovery. The recovery value was generated inside Vault under `gala_live_recovery_secret` and copied privately into Vercel. No secret literal was embedded in SQL history. Browser roles cannot read Vault. Environment updates alone do not change the currently deployed application.

Webhook subscriptions: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`. No Vercel Preview bypass is used on the live destination.

## Verification evidence

Private, ignored directory `.codex-remote-attachments/live-setup/` contains:

- `membership-before.json`, `membership-after.json`, `membership-final.json`, `membership-normalized-final.json`
- `installation-result.json`, `closed-final.json`, `hosted-verification.json`
- `stripe-verification.json`, `recovery-verification.json`, `vercel-production-metadata.json`

Other files there contain credentials; never attach or commit the directory. Supabase CLI local `.temp` state is also ignored.

Local verification: 13 production-database/access tests passed, including both new operator SQL checks, preservation of actual repository membership schema/behavior, and rejection of an accidentally open installation. SQL reproducibility passed. Prior application baseline remains 177 Gala tests, 3 OAuth tests, build and 82 HTTP checks; this setup did not change application runtime code. A full suite/build was not repeated merely for provider configuration and documentation.

## Remaining release sequence

1. Prepare and review the concrete application release from the feature branch; deployment has not occurred. Keep both database submission flags false. Do not interpret the service setup as sales activation.
2. Deploy the approved application with live routing enabled only in Production. Verify code-free buyer sessions, shared admin/Dues access and closed-sales behavior. Confirm environment identity and public privacy before any real order.
3. Enable the staged webhook and verify signature handling/delivery without an artificial real-money purchase. Enable the recovery schedule only after its authenticated endpoint works; confirm an empty pass updates the heartbeat. Record release commit and actual evidence. Credential creation and inactive jobs are not evidence of delivery.
4. On explicit user approval, open the intended database submission flags. Verify public checkout availability, then monitor the first genuine purchase, ledger entry and payment heartbeat.

The current code gate `LIVE_RELEASE_APPROVED` and Vercel gate remain false. No source guard was relaxed during setup. This remaining work is release/deployment acceptance, not another list of OSG business decisions.

For a post-launch pause, close new sales/invitations while preserving webhook/recovery processing for already-issued payments. Do not disable settlement as a routine pause, delete paid records or restore the whole shared database to undo a Gala change.

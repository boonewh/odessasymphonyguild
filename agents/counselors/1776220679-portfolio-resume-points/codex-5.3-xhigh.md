**1. Short project description**  
Built a production-grade membership and payment platform for the Odessa Symphony Guild using Next.js 16, TypeScript, Supabase, and QuickBooks Online. The system handles end-to-end student enrollment, secure payment orchestration, and admin operations, including live pricing, roster management, and automated paid-status updates via signed webhooks.

**2. Long project description**  
Developed a full-stack web platform for the Odessa Symphony Guild’s Belles & Beaux program that replaced manual membership intake and payment tracking with a structured, auditable workflow. Families complete a three-step registration flow with robust client/server validation, dynamic guardian capture (1–4 guardians), legal media-release consent with e-signature, reCAPTCHA bot protection, and real-time dues logic based on grade and membership type. Submissions are persisted to Supabase and optionally trigger QuickBooks customer/invoice creation with hosted payment links.

Implemented a full QuickBooks integration lifecycle: OAuth 2.0 authorization, encrypted token storage, automatic token refresh, invoice generation with online payment enabled, and webhook-driven payment reconciliation. Built secure, password-protected admin tools for roster operations and live pricing updates, with backward-compatible data handling for legacy records and print-friendly reporting. The project demonstrates practical product engineering across frontend UX, API design, data modeling, third-party payment systems, and security hardening.

**3. Resume bullet points**  
- Architected and shipped an end-to-end membership enrollment and dues-payment platform using Next.js 16 App Router, TypeScript, Supabase, and QuickBooks Online.  
- Built a 3-step React registration flow with step-aware validation and progressive completion UX.  
- Implemented dynamic guardian capture (1–4 guardians) with `useFieldArray`, including relationship selection and conditional fields.  
- Added “same address as Guardian 1” automation to reduce form friction and input duplication.  
- Enforced cross-field business rules with Zod `superRefine` (required at least one guardian email for invoice delivery).  
- Implemented live phone-number formatting for student and guardian records during input.  
- Built grade-aware membership logic that auto-assigns freshman pricing and conditionally exposes non-freshman tier choices.  
- Calculated dues via typed membership rules and displayed real-time totals before submission.  
- Loaded live dues and late fees from a settings API with resilient hardcoded fallback behavior.  
- Integrated Google reCAPTCHA v2 checkbox on the client with server-side token verification.  
- Embedded legal media-release terms directly into signup and captured consent, social opt-out, and e-signature fields.  
- Persisted registration records with school-year scoping to isolate multi-year program data.  
- Mapped flexible guardian arrays to relational DB columns (36 guardian fields total across 4 guardians).  
- Implemented robust submission API validation with typed error responses for client-safe error handling.  
- Designed graceful degradation so QuickBooks failures do not block successful student registration persistence.  
- Built QuickBooks OAuth 2.0 authorization endpoint with CSRF `state` generation and secure redirect flow.  
- Implemented OAuth callback exchange and secure redirect-only response behavior for Intuit compliance.  
- Encrypted QuickBooks realm/access/refresh tokens at rest using AES-256-GCM.  
- Implemented token vault read/write helpers for Supabase-backed encrypted credential storage.  
- Added automatic access-token refresh logic when expired, including refresh-expiry handling.  
- Created reusable QuickBooks request wrapper with environment switching (sandbox/production).  
- Implemented customer find-or-create flow keyed by primary email to avoid duplicate payer records.  
- Generated invoices with due dates, line items, and online ACH/credit-card payment enablement.  
- Added multi-recipient invoice send support for additional guardian emails.  
- Logged `intuit_tid` correlation IDs from QuickBooks API calls for production troubleshooting.  
- Implemented signed webhook ingestion for payment events with HMAC-SHA256 verification.  
- Used `timingSafeEqual` for safer signature comparison on webhook authenticity checks.  
- Solved non-obvious QuickBooks event modeling by resolving Payment events to Invoice IDs via `Payment.Line[].LinkedTxn[]`.  
- Automated paid-status synchronization by marking students paid in Supabase when linked invoices are settled.  
- Built admin login API that issues `httpOnly`, `sameSite=strict`, secure session cookies with bounded lifetime (8 hours).  
- Protected `/admin/*` routes with Next.js middleware and Edge-compatible Web Crypto HMAC session validation.  
- Implemented real-time roster dashboard with search, grade filter, paid/unpaid filter, and KPI summary cards.  
- Added one-click paid/unpaid toggles with API-backed persistence and immediate UI refresh.  
- Implemented print-optimized admin roster output with print-specific controls and header behavior.  
- Preserved backward compatibility by supporting both new `guardian_n_*` columns and legacy `mom_*`/`dad_*` records.  
- Built admin pricing panel for 6 configurable dues/fee keys with per-field save controls.  
- Implemented settings API allowlisting and numeric validation to prevent invalid config writes.  
- Authored Supabase migration set for students, encrypted QB tokens, settings, guardian expansion, payment linking, and media-release fields.  
- Added targeted database indexes (`school_year`, `paid`, `last_name`, `qb_payment_id`) to improve roster and reconciliation queries.  
- Applied secure response headers (`no-cache`, `nosniff`, `DENY` framing) across sensitive API routes.  
- Implemented feature flags (`ENABLE_QUICKBOOKS_SYNC`, `MOCK_PAYMENT_MODE`) to separate demo/dev and live payment behavior.  
- Built a singleton mock QuickBooks client to simulate customer creation, invoice generation, and hosted payment links for local development.  
- Generated route-specific Open Graph images with `next/og` on Edge runtime for richer social sharing previews.  
- Used `next/image` optimization patterns (priority loading, responsive sizing) across media-heavy public pages.  
- Modeled domain entities with TypeScript interfaces/unions for safer form, API, and integration code.  
- Delivered a full admin + public workflow covering registration, billing, reconciliation, and reporting in one integrated codebase.

**4. Skills & Technologies list**  
- `Next.js 16` (App Router, Route Handlers, Middleware, Edge Runtime, `next/og`, `next/image`, `next/font`)  
- `React 19`, TypeScript 5, Tailwind CSS 3  
- React Hook Form (`useForm`, `useFieldArray`), Zod schema validation, cross-field validation (`superRefine`)  
- Supabase (`@supabase/supabase-js`, Postgres, schema migrations, indexes, RLS-aware design, service-role operations)  
- QuickBooks Online API, Intuit OAuth 2.0, hosted invoice/payment flows, webhook processing  
- Cryptography and security: AES-256-GCM encryption, HMAC-SHA256 signatures, Web Crypto API (`crypto.subtle`), `timingSafeEqual`, httpOnly cookies, `sameSite=strict`, secure headers  
- API and backend patterns: typed route contracts, fallback strategies, graceful degradation, idempotent-ish paid-state updates, environment-based feature flags  
- Data modeling: multi-guardian relational schema evolution, backward-compatible migrations, school-year partitioning strategy  
- Developer experience: mock integrations, toggleable payment modes, production-debug trace IDs (`intuit_tid`)  
- Deployment/runtime target: Vercel-ready Next.js architecture

**5. What makes this project stand out**  
- It is a real-world, business-critical workflow, not a demo CRUD app: intake, billing, payment collection, webhook reconciliation, and admin reporting are fully connected.  
- It solves a genuinely tricky integration edge case (Payment ID vs Invoice ID reconciliation in QuickBooks webhooks).  
- Security is implemented across multiple layers (bot protection, encrypted secrets at rest, signed webhooks, hardened admin sessions, secure headers).  
- It balances reliability with user experience via graceful degradation and fallbacks instead of hard failures.  
- It demonstrates strong schema evolution practices by expanding to 4-guardian support without breaking historical records.  
- It includes operational/admin tooling (live pricing controls, payment-status management, print workflows), which reflects product ownership beyond frontend UI.  
- It shows fluency with both Node and Edge runtime constraints, including crypto implementation differences.

**6. Suggested talking points for interview**  
1. How you designed the end-to-end architecture from form submission through payment reconciliation.  
2. The toughest QuickBooks challenge (Payment event mapping to Invoice IDs) and how you debugged/solved it.  
3. Why you chose Zod + React Hook Form and how cross-field validation improved data quality.  
4. Your encryption-at-rest approach for OAuth tokens and how key management is handled via environment config.  
5. How middleware-based admin auth works and why Edge runtime forced Web Crypto usage.  
6. Your strategy for graceful degradation when third-party billing is unavailable.  
7. How you migrated schema from legacy mom/dad columns to scalable guardian fields without data loss.  
8. How live pricing admin controls reduced operational dependency on code deployments.  
9. How you used logging and correlation IDs (`intuit_tid`) to support production incident debugging.  
10. What you would harden next (RBAC, stronger admin auth, monitoring/alerting, automated integration tests).

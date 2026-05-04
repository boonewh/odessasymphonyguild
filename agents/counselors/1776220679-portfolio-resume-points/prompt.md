# Review Request

## Question
Extract every resume-worthy technical achievement from this Next.js project (Odessa Symphony Guild website) for a developer portfolio. Be thorough and generous — the developer wants plenty of material to work with. Provide resume bullet points, project description options (short and long), and a skills/technologies list worth calling out explicitly.

## Project Summary

**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Supabase (Postgres), Vercel

**Live site:** https://www.odessasymphonyguild.org

### Feature 1: Belles & Beaux Student Membership Signup System
- Multi-step React form (3 steps) using React Hook Form + Zod validation
- Dynamic guardian system: 1–4 guardians using useFieldArray, relationship dropdowns, "same address as Guardian 1" checkbox that auto-copies address fields
- Cross-field validation (at least one guardian email required) using Zod superRefine
- Auto phone number formatting on input (custom formatter)
- Google reCAPTCHA v2 checkbox integration with server-side token verification
- Media release / photo consent legal document embedded in signup with e-signature field, stored to DB

### Feature 2: QuickBooks Online Full Integration
- Complete OAuth 2.0 flow with Intuit (authorization endpoint, callback handler, token storage)
- AES-256-GCM encryption for QB refresh tokens stored in Supabase
- Automatic access token refresh when expired
- Customer find-or-create logic (query by email, create if not found)
- Invoice creation with AllowOnlinePayment: true, due date, line items
- Hosted payment page redirect via Intuit Payments
- Webhook endpoint receiving real-time Intuit payment notifications
- HMAC-SHA256 webhook signature verification
- Payment-to-invoice resolution: QB sends Payment Create events with a Payment ID (not Invoice ID); code fetches the payment from QB API, reads Line[].LinkedTxn[] to find the associated Invoice ID, then marks the student paid in Supabase — this was a non-obvious integration challenge
- intuit_tid logging for all QB API calls for debugging

### Feature 3: Admin Roster Page
- Password-protected via httpOnly cookie + Next.js middleware
- Real-time student roster with client-side search, grade filter, paid/unpaid filter
- One-click paid/unpaid toggle via server API route
- Designed for print (hidden controls, clean layout)
- Backward-compatible: displays new guardian_N_* columns with fallback to legacy mom_*/dad_* columns for historical records

### Feature 4: Admin Pricing Panel
- Live pricing management stored in Supabase settings table
- "Connect to QuickBooks" OAuth button for treasurer
- Prices reflected on the public join form in real-time via API fetch with hardcoded fallback

### Feature 5: Security
- Edge-compatible middleware using Web Crypto API (crypto.subtle) for HMAC-SHA256 — had to rewrite from Node.js crypto module because Next.js middleware runs on the Edge runtime, not Node.js
- httpOnly cookie-based authentication for all admin routes
- Supabase service role key for trusted server-side operations (bypasses RLS appropriately)
- reCAPTCHA server-side verification
- Secure response headers on all API endpoints
- Intuit webhook signature verification (HMAC-SHA256)

### Feature 6: Database Design (Supabase/Postgres)
- Schema migrations: guardian_1 through guardian_4 columns (9 fields each × 4 guardians = 36 columns) added without breaking existing records
- Media release consent columns added in a separate migration
- Settings table for live pricing configuration
- Encrypted QB tokens table
- School year scoping for multi-year student data isolation

### Feature 7: Developer Experience
- Mock QuickBooks mode (MOCK_PAYMENT_MODE env var) for full local development without real QB credentials — simulates customer creation, invoice creation, payment links
- Graceful degradation: QB invoice creation failure does not fail the student submission
- Live pricing falls back to hardcoded defaults if DB is unavailable
- Full webhook-to-database pipeline verified end-to-end with real payments in production

## Key Files for Reference
@app/api/belles-beaux/submit/route.ts
@app/api/quickbooks/webhook/route.ts
@app/belles-beaux/join/page.tsx
@lib/validation/student.ts
@lib/quickbooks/invoice-service.ts
@middleware.ts
@app/admin/belles-beaux/page.tsx

## Instructions
You are providing an independent portfolio review. Be generous and thorough — this developer wants maximum material to choose from.

Please provide:
1. **Short project description** (2-3 sentences, for a portfolio card)
2. **Long project description** (1-2 paragraphs, for a project detail page)
3. **Resume bullet points** — as many as you can extract, action-verb led, quantified where possible
4. **Skills & Technologies list** — every technology, pattern, and concept worth naming explicitly
5. **What makes this project stand out** — what a recruiter or technical interviewer would find impressive
6. **Suggested talking points** for an interview about this project

Be direct, specific, and don't undersell anything.

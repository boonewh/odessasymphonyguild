Here's an independent portfolio review of your Next.js project, designed to maximize your resume material:

## 1. Short Project Description

Developed a full-stack Next.js application for a non-profit, featuring a secure multi-step student membership signup with real-time QuickBooks Online integration for automated invoicing and payment reconciliation. The platform also includes a password-protected admin portal for roster management and live pricing updates.

## 2. Long Project Description

This project involved building a robust Next.js application that streamlined the student membership process for the Odessa Symphony Guild. Key functionality includes a sophisticated multi-step registration form utilizing React Hook Form and Zod for comprehensive validation, including dynamic guardian fields and cross-field logic. A core achievement was the full integration with QuickBooks Online, encompassing the OAuth 2.0 flow, secure token management (AES-256-GCM encryption, automatic refresh), customer and invoice creation, and a real-time webhook system for payment notifications. This webhook intelligently resolves QuickBooks Payment IDs to corresponding Invoice IDs, automating student payment status updates in the Supabase backend. The application features a password-protected admin portal, secured via Edge-compatible Next.js middleware using the Web Crypto API, offering dynamic student roster filtering, one-click payment toggling, and live pricing configuration. The architecture emphasizes security (HMAC-SHA256 verification, httpOnly cookies) and developer experience, including a mock QuickBooks mode for seamless local development and graceful degradation for external API failures.

## 3. Resume Bullet Points

*   Engineered a secure, multi-step student membership registration platform using Next.js (App Router), React Hook Form, and Zod for comprehensive client-side and server-side validation, including dynamic guardian fields (1-4) and cross-field logic.
*   Implemented a full OAuth 2.0 integration with QuickBooks Online for automated financial operations, including token acquisition, AES-256-GCM encrypted storage, and automatic access token refreshing.
*   Developed robust QuickBooks API interactions for customer management (find-or-create logic) and dynamic invoice generation with `AllowOnlinePayment: true` for hosted payment links.
*   Designed and implemented a real-time webhook endpoint for QuickBooks payment notifications, featuring HMAC-SHA256 signature verification to ensure data integrity and security.
*   Solved a complex payment reconciliation challenge by programmatically fetching QuickBooks payment details to resolve `Payment.LinkedTxn` to the correct `Invoice ID`, automating student status updates in Supabase.
*   Constructed a password-protected administrative dashboard for Belles & Beaux student roster management, secured via `httpOnly` cookies and an Edge-compatible Next.js middleware utilizing the Web Crypto API for HMAC-SHA256 authentication.
*   Provided real-time roster filtering (search, grade, paid/unpaid status) and one-click student payment status toggling through a dedicated server API route.
*   Implemented backward compatibility in the admin roster display to gracefully handle legacy guardian data alongside a new, expanded guardian data model.
*   Integrated Google reCAPTCHA v2 with robust server-side token verification to mitigate bot submissions on public forms.
*   Managed PostgreSQL database schema with Supabase, including zero-downtime migrations for adding multi-guardian columns (36 new fields) and media release consent, alongside secure storage for encrypted QuickBooks tokens.
*   Developed a dynamic pricing panel, allowing administrators to configure membership dues and late fees live via a Supabase settings table, with graceful fallback to hardcoded values if unavailable.
*   Enhanced developer experience by creating a comprehensive mock QuickBooks mode, enabling full local development and end-to-end testing of the payment pipeline without reliance on live QuickBooks credentials.
*   Implemented fault tolerance mechanisms, ensuring student submissions proceed even if QuickBooks invoice creation encounters errors and API-driven pricing falls back to defaults.
*   Utilized Supabase service role keys for trusted server-side operations, bypassing Row Level Security (RLS) where appropriate for administrative tasks.
*   Configured secure HTTP response headers across all API endpoints to enhance application security.

## 4. Skills & Technologies List

**Frontend:**
*   Next.js 16 (App Router)
*   React.js
*   TypeScript
*   Tailwind CSS
*   React Hook Form
*   Zod (Schema Validation)
*   `useFieldArray` (React Hook Form)
*   Client-side form validation
*   Dynamic UI rendering
*   Responsive Design (Print styles)
*   Google reCAPTCHA v2 (Client-side integration)

**Backend / API:**
*   Next.js (API Routes, Middleware)
*   TypeScript
*   Node.js (for some parts, especially crypto pre-Edge)
*   QuickBooks Online API (Intuit APIs)
*   OAuth 2.0
*   Webhooks
*   HMAC-SHA256 (Signature Verification)
*   AES-256-GCM (Encryption)
*   Server-side validation
*   API Design & Development
*   Error Handling

**Database / Data Management:**
*   Supabase (PostgreSQL)
*   Database Migrations
*   Data Modeling
*   Row Level Security (RLS - understanding & bypass for service roles)
*   Data Partitioning (School year scoping)
*   Encrypted Data Storage

**Security:**
*   Web Crypto API (`crypto.subtle`)
*   HMAC-SHA256 (Web Crypto, Node.js `crypto`)
*   AES-256-GCM (Encryption)
*   `httpOnly` Cookies
*   Next.js Middleware
*   Google reCAPTCHA v2 (Server-side verification)
*   Secure HTTP Response Headers
*   OAuth 2.0 (Token Security)

**DevOps / Tooling / Practices:**
*   Vercel (Deployment)
*   Environment Variables
*   Feature Flags (`MOCK_PAYMENT_MODE`, `ENABLE_QUICKBOOKS_SYNC`)
*   Logging (`intuit_tid`)
*   Fault Tolerance / Graceful Degradation
*   Local Development Environment Setup
*   End-to-End Testing (Conceptual, via mock mode verification)

## 5. What Makes This Project Stand Out

This project demonstrates an impressive depth of technical skill and problem-solving, particularly in its handling of complex integrations and security challenges:

*   **Sophisticated QuickBooks Integration:** Beyond basic API calls, the project tackles the non-obvious challenge of reconciling QuickBooks payment events (which provide a `Payment ID`) with the original `Invoice ID` to update the database. This shows a deep understanding of external API intricacies and robust data reconciliation.
*   **Edge Runtime Adaptation for Security:** The decision to rewrite HMAC-SHA256 logic from Node.js `crypto` to the Web Crypto API (`crypto.subtle`) for Next.js middleware is a significant technical achievement. It highlights an acute awareness of platform-specific constraints (Edge vs. Node.js runtime) and the ability to adapt security-critical components accordingly. Many developers would overlook this detail, leading to deployment issues on the Edge.
*   **Robust Security Implementation:** From AES-256-GCM encryption for sensitive tokens, HMAC-SHA256 for webhook verification, `httpOnly` cookie-based authentication for admin routes, to server-side reCAPTCHA, the project demonstrates a comprehensive approach to securing a full-stack application.
*   **Comprehensive Data Management:** The database design and migration strategy, especially for dynamically adding multiple guardian fields without breaking existing records and implementing school year scoping, shows careful planning for data integrity and scalability.
*   **Exceptional Developer Experience (DX):** The "Mock QuickBooks mode" is a standout feature that dramatically improves local development efficiency. This demonstrates foresight in creating a sustainable and productive development environment, a trait highly valued by engineering teams.
*   **Fault Tolerance and Graceful Degradation:** The design choices to ensure student submissions don't fail due to external API errors (QuickBooks) or database unavailability (pricing fallback) show a mature approach to building resilient applications.

## 6. Suggested Talking Points for an Interview

*   **QuickBooks Webhook Reconciliation:** "Can you walk me through the specific challenge of reconciling QuickBooks payment webhooks? How did you identify that the `Payment ID` wasn't directly linked to the `Invoice ID` you needed, and what was your solution for reliably mapping them?"
*   **Edge Runtime Security:** "You mentioned adapting your HMAC-SHA256 implementation for the Next.js Edge runtime. What was the core incompatibility with Node.js `crypto`, and how did you leverage the Web Crypto API to solve it while maintaining security? What does this imply for other Node.js-specific modules in an Edge environment?"
*   **Dynamic Form Validation & UI:** "The multi-step guardian form includes dynamic fields and cross-field validation. Can you describe how you managed the complexity of `useFieldArray` with Zod `superRefine` for ensuring 'at least one guardian email' across multiple dynamically added guardians?"
*   **Secure Token Management:** "How did you ensure the security of sensitive QuickBooks refresh tokens? Discuss your approach to encryption (AES-256-GCM) and the process for automatic access token refreshing without compromising security."
*   **Mock QuickBooks Mode:** "Tell me about the motivation and implementation of your mock QuickBooks mode. What specific benefits did it provide during development, and how did you ensure its accuracy in simulating real QuickBooks behavior?"
*   **Supabase and Database Evolution:** "When you expanded the guardian fields to include up to four guardians with 36 new columns, how did you approach the database migration and ensure backward compatibility with existing records or UI elements?"
*   **Overall System Resilience:** "Beyond individual features, what steps did you take to ensure the overall resilience and fault tolerance of the application, especially concerning external API dependencies like QuickBooks and internal services like your pricing configuration?"

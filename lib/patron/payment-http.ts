import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { signupSchema, PATRON_PERIOD } from "./model";
import { openPatronCheckout, reconcilePatronSession, type PatronPaymentStore, type PatronStripe } from "./payment";
import type { PaymentMode } from "../gala/backend/payment-mode";
import { readLoginBody, LoginBodyTooLarge } from "../gala/backend/staff-login";
import { SECURE_HEADERS } from "../api-headers";
const token = z.string().regex(/^[a-f0-9]{64}$/);
// Older open forms may send an autofilled company field. Accept and discard it;
// autofill is not evidence of a bot. The replacement trap is fully hidden and
// has a neutral name instead of a contact-information name.
const checkoutSchema = signupSchema.extend({ accessToken: token, company: z.string().max(200).optional(), patron_guard: z.string().max(200).optional() }).strict();
const statusSchema = z.object({ id: z.uuid(), accessToken: token }).strict();
const ownerHash = (value: string) => createHash("sha256").update(value).digest("hex");
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { ...SECURE_HEADERS, "Referrer-Policy": "no-referrer" } });
type Dependencies = {
  enabled: () => boolean; open: () => boolean;
  config: () => { origin: string; token: string; paymentMode: PaymentMode };
  backend: () => Promise<{ store: PatronPaymentStore; stripe: PatronStripe }>;
};
export function patronPaymentHandlers(deps: Dependencies) {
  function access(request: Request) {
    if (!deps.enabled()) return json({ error: "Card payments are not available yet." }, 404);
    if (request.headers.get("origin") !== deps.config().origin) return json({ error: "Please use the Guild website." }, 403);
    return null;
  }
  function fail(error: unknown) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    if (error instanceof LoginBodyTooLarge) return json({ error: "The form is too large." }, 413);
    if (error instanceof SyntaxError) return json({ error: "Please check the form." }, 400);
    if (message.includes("patron_rate_limit")) return json({ error: "Too many attempts. Please try again in 15 minutes." }, 429);
    if (message.includes("patron_payment_conflict") || message.includes("patron_request_conflict")) return json({ error: "A signup or payment already exists for these details. Return to your original browser tab or contact the Guild before paying again." }, 409);
    if (message.includes("patron_payment_review")) return json({ error: "We need to check your earlier payment attempt. Please contact the Guild before trying another payment." }, 409);
    return json({ error: "We couldn’t confirm the payment step. Please retry in this tab; do not start a second payment." }, 503);
  }
  return {
    async checkout(request: Request) {
      try {
        const blocked = access(request); if (blocked) return blocked;
        if (!deps.open()) return json({ error: "Card payments are temporarily closed. Please contact the Guild." }, 409);
        const parsed = checkoutSchema.safeParse(await readLoginBody(request));
        if (!parsed.success) return json({ error: "Please check your name, contact information and permission." }, 400);
        if (parsed.data.patron_guard) return json({ error: "We couldn’t submit this form. Please refresh the Patron page and try again." }, 400);
        const { accessToken, company: _legacyCompany, patron_guard: _guard, ...input } = parsed.data;
        const config = deps.config(), { store, stripe } = await deps.backend();
        const address = (request.headers.get("x-vercel-forwarded-for") || "local").split(",")[0].trim().slice(0, 128);
        const clientHash = createHmac("sha256", config.token).update(`patron:${address}`).digest("hex");
        const payment = await store.start({ ...input, period: PATRON_PERIOD, ownerHash: ownerHash(accessToken),
          clientHash, mode: config.paymentMode, origin: config.origin });
        const result = await openPatronCheckout(store, stripe, payment, config.paymentMode);
        return json({ id: result.payment.id, status: result.payment.status, url: result.url });
      } catch (error) { return fail(error); }
    },
    async status(request: Request) {
      try {
        const blocked = access(request); if (blocked) return blocked;
        const parsed = statusSchema.safeParse(await readLoginBody(request));
        if (!parsed.success) return json({ error: "This payment link is invalid." }, 400);
        const { store, stripe } = await deps.backend(), config = deps.config();
        let payment = await store.get(parsed.data.id);
        if (!payment || payment.mode !== config.paymentMode || !timingSafeEqual(Buffer.from(payment.owner_hash), Buffer.from(ownerHash(parsed.data.accessToken))))
          return json({ error: "Open this payment in the browser tab where you started, or contact the Guild." }, 404);
        let url: string | null = null;
        if (payment.status === "pending" && payment.stripe_session_id) {
          const result = await reconcilePatronSession(store, stripe, payment.stripe_session_id, config.paymentMode);
          payment = result.payment;
          if (deps.open() && result.session.status === "open" && result.session.url && new URL(result.session.url).origin === "https://checkout.stripe.com") url = result.session.url;
        }
        return json({ id: payment.id, status: payment.status, amount: payment.amount, url,
          needsReview: payment.status === "pending" && !payment.stripe_session_id && Date.now() - Date.parse(payment.created_at) > 4 * 60_000 });
      } catch (error) { return fail(error); }
    },
  };
}

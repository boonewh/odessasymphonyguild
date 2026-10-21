export const PAYMENT_DRAFT_KEY = "osg-patron-payment-attempt";
export type PaymentDraft = { requestId: string; accessToken: string; paymentId?: string };
export function paymentDraft(): PaymentDraft {
  const stored = sessionStorage.getItem(PAYMENT_DRAFT_KEY);
  if (stored) {
    const parsed = JSON.parse(stored) as PaymentDraft;
    if (typeof parsed.requestId === "string" && /^[a-f0-9]{64}$/.test(parsed.accessToken)) return parsed;
  }
  const draft = { requestId: crypto.randomUUID(), accessToken: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("") };
  sessionStorage.setItem(PAYMENT_DRAFT_KEY, JSON.stringify(draft));
  return draft;
}

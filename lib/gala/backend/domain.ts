import { createHash } from "node:crypto";
import { quotePurchase, quoteGifts } from "../model";
import { checkoutRequest, type CheckoutRequest } from "../checkout-request";
export { checkoutRequest, type CheckoutRequest } from "../checkout-request";
export type Status = "reserved" | "awaiting_payment" | "paid" | "expired";
export type Order = {
  id: string; request_hash: string; details: CheckoutRequest; amount: number; currency: "usd";
  description: string; tier: string | null; status: Status; created_at: string;
  stripe_session_id: string | null; payment_intent_id: string | null;
};
export function priceRequest(raw: unknown) {
  const details = checkoutRequest.parse(raw);
  const quote = details.kind === "tables" ? quotePurchase(details.purchase) : {
    total: quoteGifts(details.gifts), description: "Belles & Beaux celebration gifts",
  };
  const tier = details.kind === "tables" && ["platinum", "gold", "silver"].includes(details.purchase.product)
    ? details.purchase.product : null;
  return { details, amount: quote.total, description: quote.description, tier,
    hash: createHash("sha256").update(JSON.stringify(details)).digest("hex") };
}
export interface OrderStore {
  reserve(quote: ReturnType<typeof priceRequest>): Promise<Order>;
  get(id: string): Promise<Order>;
  bind(id: string, sessionId: string): Promise<Order>;
  apply(id: string, sessionId: string, state: "paid" | "expired", paymentId: string | null, eventId: string): Promise<Order>;
  pending(): Promise<Order[]>;
}

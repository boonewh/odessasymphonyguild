import { z } from "zod";
import { contactSchema, purchaseSchema, giftsSchema } from "./model";
import { paidCartSchema } from "./cart";
const common = { requestId: z.uuid(), contact: contactSchema, allSalesFinal: z.literal(true) };
export const checkoutRequest = z.discriminatedUnion("kind", [
  z.object({ ...common, kind: z.literal("tables"), purchase: purchaseSchema }).strict(),
  z.object({ ...common, kind: z.literal("gifts"), gifts: giftsSchema }).strict(),
  paidCartSchema.safeExtend({ ...common, kind: z.literal("cart") }),
]);
export type CheckoutRequest = z.infer<typeof checkoutRequest>;

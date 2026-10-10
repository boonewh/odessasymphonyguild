import { z } from "zod";
import { contactSchema, giftSchema, purchaseSchema, quotePurchase, type Gift, type Purchase } from "./model";

export const CART_KEY = "osg-gala-cart-v1";
export const CART_EVENT = "osg-gala-cart-changed";
export const SAME_TAB_NOTICE = "Keep shopping in this same browser tab. Your cart and contact details stay here when you switch pages or refresh. A different tab, browser, or device won’t share them.";
// Bounded development quantities, not approved event purchase limits.
export const cartContentsSchema = z.object({
  purchases: z.array(purchaseSchema).max(10, "Your cart can hold up to 10 table or ticket selections."),
  gifts: z.array(giftSchema).max(20, "Your cart can hold gifts for up to 20 students."),
}).strict();
export const paidCartSchema = cartContentsSchema.refine(c => c.purchases.length + c.gifts.length > 0, "Your cart is empty.");
const draftContact = z.object({ name: z.string().max(120), email: z.string().max(254), phone: z.string().max(30) }).strict();
export const cartDraftSchema = cartContentsSchema.extend({ contact: draftContact,
  gifts: z.array(giftSchema.safeExtend({ student: z.string().max(120) })).max(20),
}).strict();
export type CartDraft = z.infer<typeof cartDraftSchema>;
export type CartContents = z.infer<typeof cartContentsSchema>;
export type CartAddition = { kind: "tables"; purchase: Purchase } | { kind: "gifts"; gifts: Gift[] };
export const emptyCart = (): CartDraft => ({ purchases: [], gifts: [], contact: { name: "", email: "", phone: "" } });
export function readCart(raw: string | null): CartDraft {
  return raw === null ? emptyCart() : cartDraftSchema.parse(JSON.parse(raw));
}
export function addToCart(cart: CartDraft, addition: CartAddition): CartDraft {
  if (addition.kind === "gifts") z.array(giftSchema).min(1).max(20).parse(addition.gifts);
  return cartDraftSchema.parse({ ...cart,
    purchases: addition.kind === "tables" ? [...cart.purchases, addition.purchase] : cart.purchases,
    gifts: addition.kind === "gifts" ? [...cart.gifts, ...addition.gifts] : cart.gifts,
  });
}
export function cartLines(cart: CartContents) {
  return [
    ...cart.purchases.map(p => { const q = quotePurchase(p); return { name: q.description, amount: q.total }; }),
    ...cart.gifts.map(g => ({ name: `Gifts for ${g.student} (grade ${g.grade}): ${g.roses} roses, ${g.cookies} cookie bags`, amount: (g.roses + g.cookies) * 1000 })),
  ];
}
export function cartTotal(cart: CartContents) { return cartLines(cart).reduce((sum, line) => sum + line.amount, 0); }
export function cartCheckout(cart: CartDraft, requestId: string) {
  return { kind: "cart" as const, requestId, contact: contactSchema.parse(cart.contact), allSalesFinal: true as const,
    ...paidCartSchema.parse({ purchases: cart.purchases, gifts: cart.gifts }) };
}

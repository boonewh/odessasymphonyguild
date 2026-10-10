import { CART_KEY, readCart, cartDraftSchema, type CartDraft } from "./cart";
import { FLYER_ATTEMPT_KEY, readAttempt } from "./checkout-attempt";
import { z } from "zod";
export const CHECKOUT_REFERENCE_KEY = "osg-gala-checkout-reference-v1";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
export function checkoutReference(storage: Storage) {
  const attempt = readAttempt(storage.getItem(FLYER_ATTEMPT_KEY));
  const raw = storage.getItem(CHECKOUT_REFERENCE_KEY);
  return attempt?.requestId ?? (raw === null ? null : z.uuid().parse(raw));
}
export function saveCart(storage: Storage, cart: CartDraft) {
  if (checkoutReference(storage)) throw new Error("Finish or cancel your current checkout before changing your cart.");
  storage.setItem(CART_KEY, JSON.stringify(cartDraftSchema.parse(cart)));
}
export function finishPaidCart(storage: Storage, id: string) {
  // An old receipt must never erase a newer shopping session.
  if (checkoutReference(storage) !== id) return;
  storage.setItem(CHECKOUT_REFERENCE_KEY, id);
  storage.removeItem(CART_KEY);
  storage.removeItem(FLYER_ATTEMPT_KEY);
}
export function clearShoppingDetails(storage: Storage) {
  const id = checkoutReference(storage);
  // Keep only an opaque reference so signing out cannot accidentally create a
  // replacement payment for an order whose result is still unknown.
  if (id) storage.setItem(CHECKOUT_REFERENCE_KEY, id);
  storage.removeItem(CART_KEY);
  storage.removeItem(FLYER_ATTEMPT_KEY);
}
export function readShopping(storage: Storage) {
  return { cart: readCart(storage.getItem(CART_KEY)), reference: checkoutReference(storage) };
}

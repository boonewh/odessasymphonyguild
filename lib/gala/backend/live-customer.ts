// Prepared primitives only. Live sessions require a future authorized route/config.
import { cookieValue, customerIdentity, createCustomerSession, sameOrigin, LIVE_CUSTOMER_COOKIE, CUSTOMER_SECONDS } from "./access";

export const liveCustomerCookieOptions = Object.freeze({
  httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: CUSTOMER_SECONDS,
});
export type LiveCustomerConfig = { key: string; origin: string };
function validate(config: LiveCustomerConfig) {
  const origin = new URL(config.origin);
  if (config.key.length < 32 || origin.protocol !== "https:" || config.origin !== origin.origin
    || origin.username || origin.password) throw new Error("Customer access is not configured.");
}
export function authorizeLiveCustomer(request: Request, config: LiveCustomerConfig, now = Date.now()) {
  validate(config);
  sameOrigin(request, config.origin);
  return customerIdentity(cookieValue(request, LIVE_CUSTOMER_COOKIE), config.key, now, "live");
}
export function liveCustomerSession(request: Request, config: LiveCustomerConfig, now = Date.now()) {
  validate(config);
  if (request.method !== "POST" || request.headers.get("origin") !== config.origin)
    throw new Error("Same-origin session request required.");
  const existing = cookieValue(request, LIVE_CUSTOMER_COOKIE);
  try { customerIdentity(existing, config.key, now, "live"); return existing; }
  catch { return createCustomerSession(config.key, now, "live"); }
}

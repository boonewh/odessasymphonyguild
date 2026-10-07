import { createHash, createHmac, randomBytes } from "node:crypto";
import { authorizeLocalRequest, equalSecret } from "./auth";

export const CUSTOMER_COOKIE = "gala_customer_session";
export const STAFF_COOKIE = "gala_staff_session";
export const CUSTOMER_SECONDS = 24 * 3600;
export const STAFF_SECONDS = 8 * 3600;
export function cookieValue(request: Request, name: string) {
  return (request.headers.get("cookie") || "").split(";").map(v => v.trim())
    .find(v => v.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}
export function secretHash(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function sameOrigin(request: Request, origin: string) {
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== origin)
    throw new Error("Same-origin request required.");
}
export function createCustomerSession(key: string, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + CUSTOMER_SECONDS}.${randomBytes(32).toString("hex")}`;
  return `${payload}.${createHmac("sha256", key).update(`gala-customer:${payload}`).digest("hex")}`;
}
export function customerIdentity(cookie: string, key: string, now = Date.now()) {
  const match = /^(\d+)\.([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(cookie);
  const seconds = Math.floor(now / 1000);
  if (!match || Number(match[1]) <= seconds || Number(match[1]) > seconds + CUSTOMER_SECONDS
    || !equalSecret(match[3], createHmac("sha256", key).update(`gala-customer:${match[1]}.${match[2]}`).digest("hex")))
    throw new Error("Customer session required.");
  return secretHash(match[2]);
}
export function staffSessionHash(request: Request) {
  const value = cookieValue(request, STAFF_COOKIE);
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error("Staff sign-in required.");
  return secretHash(value);
}
type AccessConfig = { accessMode: string; token: string; origin: string; hosted?: boolean };
export async function staffAccess(request: Request, config: AccessConfig, accounting: boolean,
  lookup: (hash: string, accounting: boolean) => Promise<unknown>) {
  if (config.accessMode === "development") {
    authorizeLocalRequest(request, config.token, config.origin, !config.hosted); return undefined;
  }
  if (config.accessMode !== "individual") throw new Error("Unknown access mode.");
  sameOrigin(request, config.origin);
  const hash = staffSessionHash(request);
  await lookup(hash, accounting);
  return hash;
}
export function customerAccess(request: Request, config: AccessConfig) {
  if (config.accessMode === "development") {
    authorizeLocalRequest(request, config.token, config.origin, !config.hosted); return undefined;
  }
  if (config.accessMode !== "individual") throw new Error("Unknown access mode.");
  sameOrigin(request, config.origin);
  return customerIdentity(cookieValue(request, CUSTOMER_COOKIE), config.token);
}

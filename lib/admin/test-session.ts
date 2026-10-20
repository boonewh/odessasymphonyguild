import { createHmac, randomBytes } from "node:crypto";
import { equalSecret } from "../gala/backend/auth";
import { ADMIN_SECONDS, SHARED_ADMIN_COOKIE } from "./test-access";
import { paymentEnvironment, type PaymentMode } from "../gala/backend/payment-mode";

// The password participates in the signature so changing it revokes old sessions.
function signature(payload: string, key: string, password: string, mode: PaymentMode) {
  paymentEnvironment(mode);
  return createHmac("sha256", key).update(JSON.stringify([mode === "live" ? "osg-live-admin-v1" : "osg-test-admin-v1", password, payload])).digest("hex");
}
export function createAdminSession(key: string, password: string, now = Date.now(), mode: PaymentMode = "sandbox") {
  if (key.length < 32 || !password) throw new Error("Admin access is not configured.");
  const payload = `${Math.floor(now / 1000) + ADMIN_SECONDS}.${randomBytes(32).toString("hex")}`;
  return `${payload}.${signature(payload, key, password, mode)}`;
}
export function validAdminSession(value: string, key: string, password: string, now = Date.now(), mode: PaymentMode = "sandbox") {
  if (key.length < 32 || !password) return false;
  const match = /^(\d+)\.([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(value);
  const seconds = Math.floor(now / 1000);
  return Boolean(match && Number(match[1]) > seconds && Number(match[1]) <= seconds + ADMIN_SECONDS
    && equalSecret(match[3], signature(`${match[1]}.${match[2]}`, key, password, mode)));
}
export function adminCookie(request: Request) {
  return (request.headers.get("cookie") || "").split(";").map(v => v.trim())
    .find(v => v.startsWith(`${SHARED_ADMIN_COOKIE}=`))?.slice(SHARED_ADMIN_COOKIE.length + 1) || "";
}

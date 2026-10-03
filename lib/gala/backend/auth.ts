import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export const DEVELOPMENT_COOKIE = "gala_development_session";
export function equalSecret(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
export function createDevelopmentSession(token: string, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + 8 * 3600}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${createHmac("sha256", token).update(payload).digest("hex")}`;
}
export function validDevelopmentSession(cookie: string, token: string, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const match = /^(\d+)\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(cookie);
  if (!match || Number(match[1]) <= Math.floor(now / 1000) || Number(match[1]) > Math.floor(now / 1000) + 8 * 3600) return false;
  return equalSecret(match[3], createHmac("sha256", token).update(`${match[1]}.${match[2]}`).digest("hex"));
}
export function authorizeLocalRequest(request: Request, token: string, origin: string) {
  const header = request.headers.get("x-gala-development-token");
  if (header && equalSecret(header, token)) return;
  const cookie = (request.headers.get("cookie") || "").split(";").map(v => v.trim())
    .find(v => v.startsWith(`${DEVELOPMENT_COOKIE}=`))?.slice(DEVELOPMENT_COOKIE.length + 1) || "";
  if (!validDevelopmentSession(cookie, token)) throw new Error("Development authentication required.");
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== origin)
    throw new Error("Same-origin request required.");
}

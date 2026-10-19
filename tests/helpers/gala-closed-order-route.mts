// Isolated route regression: fake database transport; all provider networking blocked.
import assert from "node:assert/strict";
import https from "node:https";
import { mock } from "node:test";
import { randomUUID } from "node:crypto";
import { createDevelopmentSession } from "../../lib/gala/backend/auth";
import { DEVELOPMENT_SUPABASE_URL } from "../../lib/gala/backend/config";
const token = "a".repeat(64), origin = "http://localhost:3000", id = randomUUID();
for (const key of ["VERCEL", "VERCEL_ENV", "GALA_BOARD_REVIEW", "GALA_CLIENT_REVIEW"]) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "development", GALA_BACKEND_ENABLED: "true", GALA_ACCESS_MODE: "development",
  GALA_STRIPE_SECRET_KEY: "sk_test_fake", GALA_STRIPE_WEBHOOK_SECRET: "whsec_fake", GALA_DEVELOPMENT_TOKEN: token,
  GALA_SUPABASE_URL: DEVELOPMENT_SUPABASE_URL, GALA_SUPABASE_SECRET_KEY: "sb_secret_fake", GALA_LOCAL_ORIGIN: origin });
let status = "paid", providerCalls = 0;
mock.method(https, "request", () => { providerCalls++; throw new Error("Provider blocked by test"); });
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert.equal(url.origin, DEVELOPMENT_SUPABASE_URL);
  assert.ok(!init?.method || init.method === "GET", "Closed-order lookup must not write");
  if (url.pathname === "/rest/v1/gala_environment") return Response.json({ name: "osg-gala-development" });
  assert.equal(url.pathname, "/rest/v1/gala_orders");
  return Response.json({ id, status, amount: 200000, description: "Silver table", stripe_session_id: "cs_test_old_account",
    details: { kind: "tables" } });
};
const { POST } = await import("../../app/api/gala/order/route");
const request = (authenticated = true) => new Request(`${origin}/api/gala/order?orderId=${id}`, { method: "POST",
  headers: { origin, ...(authenticated ? { cookie: `gala_development_session=${createDevelopmentSession(token)}` } : {}) } });
assert.equal((await POST(request(false))).status, 401);
for (status of ["paid", "expired"]) {
  const response = await POST(request()); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.order.status, status); assert.equal(data.url, null);
  assert.equal(providerCalls, 0, "Closed orders must not query another Stripe account");
}
status = "awaiting_payment";
assert.equal((await POST(request())).status, 409, "Unresolved orders still require provider verification");
assert.ok(providerCalls > 0);
mock.restoreAll();
console.log("Closed historical orders preserved; pending orders still require provider verification.");

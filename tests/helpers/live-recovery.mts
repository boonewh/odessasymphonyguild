import assert from "node:assert/strict";
import { POST } from "../../app/api/gala/recovery/run/route";
import { authorizeScheduledRecovery } from "../../lib/gala/backend/scheduled-recovery";
import { fixture } from "./recovery-provider.mts";

const origin = "https://gala.example", db = "https://abcdefghijklmnopqrst.supabase.co";
const secret = "b".repeat(64), sandboxSecret = "c".repeat(64), sessionSecret = "a".repeat(64);
Object.assign(process.env, {
  NODE_ENV: "production", VERCEL_ENV: "production", GALA_LIVE_ENABLED: "true",
  GALA_LIVE_ORIGIN: origin, GALA_LIVE_SUPABASE_URL: db,
  GALA_LIVE_SUPABASE_SECRET_KEY: "sb_secret_offline", GALA_LIVE_STRIPE_SECRET_KEY: "sk_live_offline",
  GALA_LIVE_STRIPE_WEBHOOK_SECRET: "whsec_offline", GALA_LIVE_SESSION_SECRET: sessionSecret,
  GALA_LIVE_RECOVERY_SECRET: secret, GALA_RECOVERY_SECRET: sandboxSecret,
  GALA_DEVELOPMENT_TOKEN: "d".repeat(64), GALA_BOARD_ACCESS_CODE: "OfflineBoard", ADMIN_PASSWORD: "OfflineAdmin",
});
delete process.env.GALA_BOARD_REVIEW; delete process.env.GALA_CLIENT_REVIEW;
const request = (token = secret, method = "POST") => new Request(origin + "/api/gala/recovery/run", {
  method, headers: { authorization: `Bearer ${token}`, cookie: "osg_test_admin_session=irrelevant" },
});
let marker = "osg-gala-production", calls = 0, claims = 0, applies = 0, failSave = false;
let queued = false, outcome = "", order: Record<string, any>, lease = "";
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input)); calls++;
  assert.equal(url.origin, db, "Unexpected network request blocked");
  if (url.pathname === "/rest/v1/gala_environment") return Response.json({ name: marker });
  if (url.pathname === "/rest/v1/gala_orders") return Response.json(order);
  const args = JSON.parse(String(init?.body || "{}"));
  if (url.pathname === "/rest/v1/rpc/gala_claim_recovery") {
    claims++; if (!queued) return Response.json(null);
    queued = false; lease = args.p_token; return Response.json(order);
  }
  if (url.pathname === "/rest/v1/rpc/gala_apply_payment") {
    assert.equal(args.p_id, order.id); assert.equal(args.p_session, order.stripe_session_id);
    if (failSave) return Response.json({ message: "Fictional save failure" }, { status: 503 });
    applies++; order.status = args.p_state; return Response.json(order);
  }
  if (url.pathname === "/rest/v1/rpc/gala_finish_recovery") {
    assert.equal(args.p_order, order.id); assert.equal(args.p_token, lease);
    outcome = args.p_outcome; return Response.json(null);
  }
  throw new Error(`Unexpected database operation: ${url.pathname}`);
};

for (const token of ["", sandboxSecret, sessionSecret, process.env.GALA_DEVELOPMENT_TOKEN!, "OfflineBoard", "OfflineAdmin"]) {
  assert.equal((await POST(request(token))).status, 401);
}
assert.equal(calls, 0); assert.equal(fixture.accountReads, 0);
assert.equal(authorizeScheduledRecovery(request(secret, "GET"), process.env), false);
for (const value of ["", "short", sandboxSecret, sessionSecret, process.env.GALA_DEVELOPMENT_TOKEN!, "OfflineBoard", "OfflineAdmin"]) {
  assert.equal(authorizeScheduledRecovery(request(value), { ...process.env, GALA_LIVE_RECOVERY_SECRET: value }), false);
}
for (const patch of [{ VERCEL_ENV: "preview" }, { NODE_ENV: "development" }, { GALA_LIVE_ENABLED: "false" }, { GALA_BOARD_REVIEW: "true" }, { GALA_CLIENT_REVIEW: "true" }]) {
  assert.equal(authorizeScheduledRecovery(request(), { ...process.env, ...patch }), false);
}
process.env.GALA_LIVE_ENABLED = "false";
assert.equal((await POST(request())).status, 404); process.env.GALA_LIVE_ENABLED = "true";
fixture.account = "acct_1UPo5p46WzPrgtpT";
assert.equal((await POST(request())).status, 503); assert.equal(claims, 0);
fixture.account = "acct_1UPo5fKdKFOoaTnc"; marker = "osg-gala-development";
assert.equal((await POST(request())).status, 503); assert.equal(claims, 0);
marker = "osg-gala-production"; fixture.providerDown = true;
assert.equal((await POST(request())).status, 503); assert.equal(claims, 0); fixture.providerDown = false;

function prepare(status = "complete", paid = true) {
  queued = true; outcome = ""; failSave = false;
  order = { id: "00000000-0000-4000-8000-000000000001", amount: 200000, currency: "usd",
    status: "awaiting_payment", created_at: new Date(Date.now() - 36 * 60_000).toISOString(),
    stripe_session_id: "cs_live_offline", details: {} };
  const metadata = { gala_order_id: order.id, application: "osg-gala-2027" };
  fixture.session = { id: order.stripe_session_id, livemode: true, mode: "payment", currency: "usd",
    amount_total: order.amount, client_reference_id: order.id, metadata, status,
    payment_status: paid ? "paid" : "unpaid", payment_intent: paid ? "pi_offline" : null };
  fixture.payment = { id: "pi_offline", livemode: true, currency: "usd", amount: order.amount,
    amount_received: order.amount, metadata, status: "succeeded" };
}
prepare();
const paid = await POST(request()); assert.equal(paid.status, 200); assert.equal(paid.headers.get("cache-control"), "no-store");
assert.deepEqual(await paid.json(), { checked: 1 }); assert.equal(outcome, "paid"); assert.equal(order.status, "paid");
assert.equal(applies, 1); assert.equal(fixture.paymentReads, 1);
// A subsequent pass has no claimed work and cannot reapply the payment.
assert.deepEqual(await (await POST(request())).json(), { checked: 0 }); assert.equal(applies, 1);
prepare("open", false);
assert.equal((await POST(request())).status, 200); assert.equal(outcome, "expired"); assert.equal(fixture.expires, 1);
assert.equal(order.status, "expired"); assert.equal(applies, 2);
prepare(); fixture.session.livemode = false;
assert.equal((await POST(request())).status, 200); assert.equal(outcome, "retry_required");
assert.equal(order.status, "awaiting_payment"); assert.equal(applies, 2);
prepare(); failSave = true;
assert.equal((await POST(request())).status, 200); assert.equal(outcome, "retry_required");
assert.equal(order.status, "awaiting_payment"); assert.equal(applies, 2);
console.log("Live scheduled recovery: isolated authorization, identity, settlement, expiration and uncertain-save checks passed.");

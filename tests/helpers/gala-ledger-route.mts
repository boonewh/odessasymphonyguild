// Executed in an isolated react-server process. Fake transport; no external calls.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDevelopmentSession } from "../../lib/gala/backend/auth";
import { priceRequest } from "../../lib/gala/backend/domain";
import { DEVELOPMENT_SUPABASE_URL } from "../../lib/gala/backend/config";

const token = "a".repeat(64), origin = "http://localhost:3000";
for (const key of ["VERCEL", "VERCEL_ENV", "GALA_BOARD_REVIEW", "GALA_CLIENT_REVIEW"]) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "development", GALA_BACKEND_ENABLED: "true", GALA_ACCESS_MODE: "development",
  GALA_STRIPE_SECRET_KEY: "sk_test_fake", GALA_STRIPE_WEBHOOK_SECRET: "whsec_fake", GALA_DEVELOPMENT_TOKEN: token,
  GALA_SUPABASE_URL: DEVELOPMENT_SUPABASE_URL, GALA_SUPABASE_SECRET_KEY: "sb_secret_fake", GALA_LOCAL_ORIGIN: origin });
const id = randomUUID(), details = { kind: "cart", requestId: id, allSalesFinal: true,
  contact: { name: "Endpoint Test", email: "endpoint@example.com", phone: "4325550101" },
  purchases: [{ product: "silver", quantity: 1, extraSeats: 0 }], gifts: [{ student: "Test Student", grade: "12", roses: 1, cookies: 1 }] };
const source = { orders: [{ id, details, amount: priceRequest(details).amount, currency: "usd", status: "paid", created_at: "2026-10-13T02:00:00Z",
  confirmed_at: "2026-10-13T02:05:00Z", stripe_session_id: "cs_test_" + id, payment_intent_id: "pi_" + id }],
  accounting: [{ order_id: id, status: "pending", dispatched_at: null, receipt_id: null, realm_id: null }] };
let fail = false, allowed = false, reads = 0, permissionChecks = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert.equal(url.origin, DEVELOPMENT_SUPABASE_URL, "Unexpected external request");
  if (url.pathname === "/rest/v1/rpc/gala_staff_identity") {
    permissionChecks++;
    assert.equal(JSON.parse(String(init?.body)).p_accounting, true);
    return Response.json(allowed ? { userId: randomUUID(), accounting: true } : null);
  }
  if (url.pathname === "/rest/v1/gala_environment") return Response.json({ name: "osg-gala-development" });
  assert.equal(url.pathname, "/rest/v1/rpc/gala_ledger_snapshot"); reads++;
  return fail ? Response.json({ message: "Unavailable" }, { status: 503 }) : Response.json(source);
};
const { GET } = await import("../../app/api/gala/ledger/route");
const { POST } = await import("../../app/api/gala/quickbooks/sync/route");
const cookie = `gala_development_session=${createDevelopmentSession(token)}`;
const request = (query = "", authenticated = true) => new Request(origin + "/api/gala/ledger" + query, { headers: authenticated ? { cookie } : {} });
assert.equal((await GET(request("", false))).status, 401); assert.equal(reads, 0);
const response = await GET(request()); assert.equal(response.status, 200);
assert.equal(response.headers.get("Cache-Control"), "no-store");
const report = await response.json(); assert.equal(report.paidAmount, 202000); assert.equal(report.lines.length, 3);
assert.equal(report.preview.canSend, false);
const csv = await GET(request("?format=csv&product=rose")); assert.equal(csv.status, 200);
assert.match(csv.headers.get("Content-Disposition")!, /attachment/);
const text = await csv.text(); assert.match(text, /"Rose"/); assert.doesNotMatch(text, /"Silver table"/);
const summary = await GET(request("?format=summary")); assert.match(await summary.text(), /"Total paid sales","","2020.00"/);
const preview = await (await GET(request("?format=preview&product=rose"))).json();
assert.equal(preview.amount, 202000); assert.deepEqual(preview.orderIds, [id]); assert.equal(preview.lines.length, 3);
const beforeInvalid = reads;
assert.equal((await GET(request("?format=other"))).status, 400);
assert.equal((await GET(request("?from=2026-10-14&to=2026-10-13"))).status, 400); assert.equal(reads, beforeInvalid);
source.orders[0].amount++;
const mismatch = await GET(request()); assert.equal(mismatch.status, 503); assert.doesNotMatch(await mismatch.text(), /endpoint@example|Test Student|202001/);
source.orders[0].amount--; fail = true;
for (const format of ["json", "csv", "summary", "preview"]) assert.equal((await GET(request("?format=" + format))).status, 503);
fail = false;
process.env.GALA_QB_SYNC_ENABLED = "true";
const beforeSync = reads;
assert.equal((await POST(new Request(origin + "/api/gala/quickbooks/sync", { method: "POST", headers: { cookie, origin } }))).status, 404);
assert.equal(reads, beforeSync, "Retired sender must not reach database or provider");
process.env.GALA_ACCESS_MODE = "individual";
const staffRequest = () => new Request(origin + "/api/gala/ledger", { headers: { cookie: "gala_staff_session=" + "b".repeat(64) } });
assert.equal((await GET(request())).status, 401);
assert.equal((await GET(staffRequest())).status, 401); allowed = true;
assert.equal((await GET(staffRequest())).status, 200); assert.equal(permissionChecks, 2);
process.env.NODE_ENV = "production";
assert.equal((await GET(request())).status, 404);
console.log("Ledger route responses, permissions, downloads, failure handling and retired sender verified with fake transport.");

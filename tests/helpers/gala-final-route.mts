// Retired routes must never touch credentials, the database, or a provider.
import assert from "node:assert/strict";
process.env.NODE_ENV = "development";
process.env.GALA_BACKEND_ENABLED = "true";
process.env.GALA_QB_FINAL_ENABLED = "true";
process.env.GALA_QB_SYNC_ENABLED = "true";
let calls = 0;
globalThis.fetch = async () => { calls++; throw new Error("Unexpected provider/database call"); };
for (const route of ["connect", "callback", "status", "sync", "final-total"]) {
  const handlers = await import(`../../app/api/gala/quickbooks/${route}/route`);
  for (const method of ["GET", "POST"]) if (handlers[method]) {
    const response = await handlers[method](new Request(`http://localhost:3000/api/gala/quickbooks/${route}`, {method}));
    assert.equal(response.status, 404);
  }
}
assert.equal(calls, 0);
console.log("Final route checks passed: every Gala QuickBooks route is retired, with no external calls.");

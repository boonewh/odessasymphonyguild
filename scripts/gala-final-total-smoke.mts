// Opt-in REAL QuickBooks sandbox write, using a separate durable fictional ledger.
// Never clears existing receipts or final batches. Reruns recover the same batch.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { finalDatabase } from "../tests/helpers/gala-final-database.mjs";
import { priceRequest } from "../lib/gala/backend/domain";
import { ledgerReport } from "../lib/gala/backend/ledger";
import { prepareFinal } from "../lib/gala/backend/final-total";
import { syncReceipt, verifyReceipt, type Receipt } from "../lib/gala/backend/accounting";
import { readQbConfig, readQbMapping, QB_SANDBOX_BASE } from "../lib/gala/backend/qb-config";
import { AccountingDatabase } from "../lib/gala/backend/accounting-store";
import { SandboxQuickBooks, qbAccessToken } from "../lib/gala/backend/qb-client";

async function main() {
  if (process.env.GALA_FINAL_SANDBOX_TEST !== "true" || process.env.VERCEL || process.env.VERCEL_ENV) throw new Error("Local sandbox opt-in required.");
  const config = readQbConfig(process.env), mapping = readQbMapping(process.env), owner = randomUUID();
  const connection = new AccountingDatabase(config.url, config.dbKey); await connection.verify(); await connection.lock(owner);
  const dir = ".codex-remote-attachments/final-total"; await mkdir(dir, { recursive: true });
  let local: Awaited<ReturnType<typeof finalDatabase>> | undefined;
  try {
    const token = await qbAccessToken(config, connection, owner);
    async function request(path: string, body?: object) {
      const r = await fetch(`${QB_SANDBOX_BASE}${config.realmId}/${path}`, { method: body ? "POST" : "GET", redirect: "error",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`Sandbox mapping request failed (${r.status}).`); return r.json();
    }
    // Dedicated test income/item preserve the earlier per-order sandbox setup.
    const accounts = await request("query?query=" + encodeURIComponent("select * from Account where Name = 'Symphony Ball Revenue' maxresults 2"));
    let income = accounts.QueryResponse?.Account || []; assert.ok(income.length < 2);
    if (!income.length) income = [(await request("account?requestid=gala-final-income-2027", { Name: "Symphony Ball Revenue", AccountType: "Income", AccountSubType: "SalesOfProductIncome" })).Account];
    assert.equal(income[0].Name, "Symphony Ball Revenue"); mapping.incomeAccountId = income[0].Id;
    const items = await request("query?query=" + encodeURIComponent("select * from Item where Name = 'Gala final total sandbox' maxresults 2"));
    let item = items.QueryResponse?.Item || []; assert.ok(item.length < 2);
    if (!item.length) item = [(await request("item?requestid=gala-final-item-2027", { Name: "Gala final total sandbox", Type: "Service", IncomeAccountRef: { value: mapping.incomeAccountId } })).Item];
    mapping.itemId = item[0].Id;
    const gateway = new SandboxQuickBooks(config.realmId, token); await gateway.verifyMapping(mapping, true);
    local = await finalDatabase(dir + "/database");
    let batch = await local.totals.current();
    if (!batch) {
      const existing = await local.snapshot();
      if (!existing.orders.length) {
        for (const details of [
          { kind: "cart", purchases: [{ product: "silver", quantity: 1, extraSeats: 0 }, { product: "student-date", quantity: 1, extraSeats: 0 }], gifts: [{ student: "Fictional Final Student", grade: "12", roses: 1, cookies: 1 }] },
          { kind: "gifts", gifts: [{ student: "Fictional Second Student", grade: "9", roses: 2, cookies: 1 }] },
        ]) {
          const id = randomUUID(), quote = priceRequest({ ...details, requestId: id, allSalesFinal: true,
            contact: { name: "Fictional Final-total Rehearsal", email: "final-total@example.com", phone: "4325550100" } });
          await local.store.reserve(quote);
          // Synthetic payment evidence exists ONLY in this isolated local ledger.
          await local.store.apply(id, "cs_test_rehearsal_" + id, "paid", "pi_rehearsal_" + id, "evt_rehearsal_" + id);
        }
      }
      const source = await local.snapshot(), report = ledgerReport(source);
      batch = await local.totals.freeze(prepareFinal(source, report.preview.revision, randomUUID(), mapping));
    }
    assert.equal(batch.realm_id, config.realmId); assert.deepEqual(batch.mapping, mapping);
    let posts = 0;
    const create = gateway.create.bind(gateway);
    gateway.create = async (payload: Receipt, id: string) => { posts++; await create(payload, id); throw new Error("Deliberately lost sandbox create response"); };
    const send = () => syncReceipt(local!.totals, gateway, batch.id, randomUUID(), async () => { throw new Error("Frozen payload required"); });
    const first = await send(); assert.ok(["review", "busy_or_synced"].includes(first));
    const finish = local.totals.finish;
    local.totals.finish = async () => { throw new Error("Deliberately failed local success save"); };
    const second = await send(); assert.ok(["review", "busy_or_synced"].includes(second));
    local.totals.finish = finish;
    await send(); await send();
    const saved = await local.totals.current(); assert.equal(saved.status, "synced");
    const matches = await gateway.find(batch.payload.DocNumber); assert.equal(matches.length, 1); assert.equal(verifyReceipt(matches[0], batch.payload), saved.receipt_id);
    assert.equal(saved.amount, 215000); assert.equal(saved.lines.length, 6); assert.ok(posts <= 1);
    assert.equal((await local.db.query('select * from gala_final_total_orders')).rows.length, 2);
    assert.equal(ledgerReport(await local.snapshot()).paidAmount, 215000);
    const evidence = { sandboxCompany: config.realmId, batchId: saved.id, receiptId: saved.receipt_id, totalCents: saved.amount,
      orders: 2, itemRows: 6, postsThisRun: posts, matchingReceipts: matches.length, status: saved.status,
      lossAndSaveFailureRecovery: true, source: "isolated local fictional ledger; synthetic payment evidence", checkedAt: new Date().toISOString() };
    await writeFile(dir + "/evidence.json", JSON.stringify(evidence, null, 2));
    await writeFile(dir + "/saved-total.json", JSON.stringify(saved, null, 2));
    // Install only the verified sandbox mapping locally; sending remains opt-in.
    let env = await readFile(".env.local", "utf8");
    for (const [key, value] of Object.entries({ GALA_QB_FINAL_INCOME_ACCOUNT_ID: mapping.incomeAccountId, GALA_QB_FINAL_ITEM_ID: mapping.itemId })) {
      const re = new RegExp("^" + key + "=.*$", "m"); env = re.test(env) ? env.replace(re, key + "=" + value) : env + "\n" + key + "=" + value;
    }
    await writeFile(".env.local", env + "\n");
    console.log(JSON.stringify(evidence));
  } finally { await local?.db.close(); await connection.unlock(owner); }
}
main().catch((e) => { console.error("Final-total sandbox rehearsal stopped:", e.message?.replace(/https?:\/\/\S+/g, "[url]")); process.exitCode = 1; });

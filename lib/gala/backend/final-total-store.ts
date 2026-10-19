import { createClient } from "@supabase/supabase-js";
import { databaseFetch } from "./database-fetch";
import type { AccountingStore, AccountingJob } from "./accounting";
import type { FinalBatch, prepareFinal } from "./final-total";

export class FinalTotalDatabase implements AccountingStore {
  private db;
  constructor(url: string, key: string) { this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: databaseFetch() } }); }
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await this.db.rpc(name, args);
    if (error) throw new Error("Final total could not be saved. Refresh to check whether it was already saved or the ledger changed.");
    return data;
  }
  async current(): Promise<FinalBatch | null> {
    const { data, error } = await this.db.from("gala_final_total").select("*").eq("gala", "2027").maybeSingle();
    if (error) throw new Error("Final sending setup is not ready. Apply development migration 013 first.");
    return data;
  }
  async freeze(prepared: ReturnType<typeof prepareFinal>, actor: string): Promise<FinalBatch> {
    return this.rpc("gala_final_prepare", { p_id: prepared.id, p_revision: prepared.revision, p_source: prepared.source,
      p_lines: prepared.lines, p_mapping: prepared.mapping, p_payload: prepared.payload, p_actor: actor });
  }
  async claim(id: string, owner: string): Promise<AccountingJob | null> { return this.rpc("gala_final_claim", { p_id: id, p_owner: owner }); }
  async prepare(): Promise<AccountingJob> { throw new Error("Final payload must already be frozen."); }
  async dispatch(id: string, owner: string) { await this.rpc("gala_final_dispatch", { p_id: id, p_owner: owner }); }
  async finish(id: string, owner: string, receiptId: string) { await this.rpc("gala_final_finish", { p_id: id, p_owner: owner, p_receipt: receiptId }); }
  async review(id: string, owner: string, code: string) { await this.rpc("gala_final_review", { p_id: id, p_owner: owner, p_code: code }); }
}

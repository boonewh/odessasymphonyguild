import { createClient } from "@supabase/supabase-js";
import type { AccountingJob, AccountingStore, Receipt } from "./accounting";

export class AccountingDatabase implements AccountingStore {
  private db;
  constructor(url: string, key: string) { this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await this.db.rpc(name, args);
    if (error) throw new Error("Development accounting database operation failed.");
    return data;
  }
  async verify() {
    const { data, error } = await this.db.from("gala_environment").select("name").eq("id", 1).single();
    if (error || data?.name !== "osg-gala-development") throw new Error("Development database required.");
  }
  async claim(id: string, owner: string): Promise<AccountingJob | null> { return this.rpc("gala_accounting_claim", { p_id: id, p_owner: owner }); }
  async prepare(id: string, owner: string, realm: string, payload: Receipt): Promise<AccountingJob> {
    return this.rpc("gala_accounting_prepare", { p_id: id, p_owner: owner, p_realm: realm, p_payload: payload });
  }
  async dispatch(id: string, owner: string) { await this.rpc("gala_accounting_dispatch", { p_id: id, p_owner: owner }); }
  async finish(id: string, owner: string, receiptId: string) { await this.rpc("gala_accounting_finish", { p_id: id, p_owner: owner, p_receipt: receiptId }); }
  async review(id: string, owner: string, code: string) { await this.rpc("gala_accounting_review", { p_id: id, p_owner: owner, p_code: code }); }
  async lock(owner: string) { if (!await this.rpc("gala_qb_lock", { p_owner: owner })) throw new Error("Another QuickBooks operation is running."); }
  async unlock(owner: string) { await this.rpc("gala_qb_unlock", { p_owner: owner }); }
  async loadTokens(): Promise<string | null> {
    const { data, error } = await this.db.from("gala_qb_connection").select("sealed_tokens").eq("id", 1).single();
    if (error) throw new Error("Apply the development accounting migration first.");
    return data.sealed_tokens;
  }
  async saveTokens(owner: string, sealed: string) { await this.rpc("gala_qb_save", { p_owner: owner, p_sealed: sealed }); }
}

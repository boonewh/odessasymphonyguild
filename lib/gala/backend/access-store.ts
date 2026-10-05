import { createClient } from "@supabase/supabase-js";
import { databaseFetch } from "./database-fetch";
import { STAFF_SECONDS } from "./access";
import type { LoginAdmission } from "./staff-login";

export class AccessStore {
  private db;
  constructor(url: string, key: string, transport = databaseFetch()) {
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: transport } });
  }
  async staff(hash: string, accounting = false) {
    const { data, error } = await this.db.rpc("gala_staff_identity", { p_session: hash, p_accounting: accounting });
    if (error || !data) throw new Error("Staff access unavailable.");
    return data as { userId: string; accounting: boolean };
  }
  async consumeLogin(bucket: string): Promise<LoginAdmission> {
    const { data, error } = await this.db.rpc("gala_consume_staff_login", { p_account: bucket });
    if (error || typeof data?.allowed !== "boolean" || !Number.isInteger(data.retryAfter)
      || (data.allowed ? data.retryAfter !== 0 : data.retryAfter < 1 || data.retryAfter > 900))
      throw new Error("Login limiter unavailable.");
    return data as LoginAdmission;
  }
  async login(email: string, password: string) {
    // Dedicated Gala project only; never use membership Auth or browser-supplied identities.
    const { data, error } = await this.db.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error("Sign-in failed.");
    // signIn changes this client's bearer token; use a separate service client for private RPCs.
    return data.user.id;
  }
  async createSession(userId: string, hash: string) {
    const { error } = await this.db.rpc("gala_create_staff_session", { p_user: userId, p_session: hash, p_seconds: STAFF_SECONDS });
    if (error) throw new Error("Sign-in failed.");
  }
  async rotateSession(userId: string, hash: string, previousHash?: string) {
    // Confirm revocation before issuing a replacement. A failed/lost delete
    // response must not report successful rotation while the old session works.
    if (previousHash) await this.logout(previousHash);
    await this.createSession(userId, hash);
  }
  async logout(hash: string) {
    const { error } = await this.db.from("gala_staff_sessions").delete().eq("token_hash", hash);
    if (error) throw new Error("Sign-out not confirmed.");
  }
}

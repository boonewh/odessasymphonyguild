import "server-only";
import { createClient } from "@supabase/supabase-js";
import { databaseFetch } from "../gala/backend/database-fetch";
import { patronConfig } from "./config";
import type { Patron, PatronStore } from "./model";

export async function getPatronStore(): Promise<PatronStore> {
  const config = patronConfig();
  if (config.local) return (await import("./local-store")).getLocalPatronStore();
  return supabasePatronStore(config.url, config.dbKey);
}

export function supabasePatronStore(url: string, key: string, transport: typeof fetch = fetch): PatronStore {
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: databaseFetch(20_000, transport) },
  });
  // Explicit paging avoids silently truncating the public or admin roster at
  // Supabase's response limit. Only the public-name column is read for visitors.
  async function rows(period: string, publicOnly: boolean) {
    const result: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = db.from("patron_members")
        .select(publicOnly ? "name" : "id,period,name,email,phone,source,published,created_at")
        .eq("period", period).order("name").order("id").range(offset, offset + 499);
      if (publicOnly) query = query.eq("published", true);
      const { data, error } = await query;
      if (error) throw error;
      result.push(...data as unknown as Record<string, unknown>[]);
      if (data.length < 500) return result;
    }
  }
  return {
    async names(period) { return [...new Set((await rows(period, true)).map(row => String(row.name)))]; },
    async list(period) { return await rows(period, false) as unknown as Patron[]; },
    async add(input) {
      const { error } = await db.rpc("patron_add", { p_input: input });
      if (error) throw error;
    },
    async edit({ id, ...input }, period) {
      const { data, error } = await db.from("patron_members").update(input).eq("id", id).eq("period", period).select("id");
      if (error) throw error;
      return data.length === 1;
    },
  };
}

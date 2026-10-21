import "server-only";
import type { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { databaseFetch } from "../gala/backend/database-fetch";
import { patronConfig } from "./config";
import type { PatronPayment, PatronPaymentStore } from "./payment";

export function localPatronPayments(db: PGlite): PatronPaymentStore {
  return {
    async start(input) { return (await db.query<PatronPayment>("select * from public.patron_payment_start($1::jsonb)", [JSON.stringify(input)])).rows[0]; },
    async get(id) { return (await db.query<PatronPayment>("select * from patron_payments where id=$1", [id])).rows[0] || null; },
    async apply(id, session, status, payment) { await db.query("select patron_payment_apply($1,$2,$3,$4)", [id, session, status, payment]); },
    async pending() { return (await db.query<PatronPayment>("select * from patron_payments where status='pending' order by checked_at nulls first,created_at limit 25")).rows; },
    async touched(id) { await db.query("update patron_payments set checked_at=now() where id=$1", [id]); },
  };
}
export function hostedPatronPayments(url: string, key: string, transport: typeof fetch = fetch): PatronPaymentStore {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: databaseFetch(20_000, transport) } });
  return {
    async start(input) { const { data, error } = await db.rpc("patron_payment_start", { p_input: input }).single(); if (error) throw error; return data as PatronPayment; },
    async get(id) { const { data, error } = await db.from("patron_payments").select("*").eq("id", id).maybeSingle(); if (error) throw error; return data as PatronPayment | null; },
    async apply(id, session, status, payment) { const { error } = await db.rpc("patron_payment_apply", { p_id: id, p_session: session, p_status: status, p_payment: payment }); if (error) throw error; },
    async pending() { const { data, error } = await db.from("patron_payments").select("*").eq("status", "pending").order("checked_at", { nullsFirst: true }).order("created_at").limit(25); if (error) throw error; return data as PatronPayment[]; },
    async touched(id) { const { error } = await db.from("patron_payments").update({ checked_at: new Date().toISOString() }).eq("id", id); if (error) throw error; },
  };
}
export async function getPatronPaymentStore() {
  const config = patronConfig();
  return config.local ? localPatronPayments(await (await import("./local-store")).getLocalPatronDatabase()) : hostedPatronPayments(config.url, config.dbKey);
}

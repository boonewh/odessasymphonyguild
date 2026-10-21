import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Patron, PatronStore } from "./model";

export function localPatronStore(db: PGlite): PatronStore {
  return {
    async names(period) {
      return (await db.query<{ name: string }>("select distinct name from patron_members where period=$1 and published order by name", [period])).rows.map(row => row.name);
    },
    async list(period) {
      return (await db.query<Patron>("select * from patron_members where period=$1 order by name,id", [period])).rows;
    },
    async add(input) { await db.query("select patron_add($1::jsonb)", [JSON.stringify(input)]); },
    async edit(input, period) {
      if (input.checkReceived) {
        return (await db.query<{ saved: boolean }>("select patron_record_check($1::jsonb,$2) as saved", [JSON.stringify(input), period])).rows[0].saved;
      }
      const result = await db.query("update patron_members set name=$1,email=$2,phone=$3,published=$4 where id=$5 and period=$6 returning id",
        [input.name, input.email, input.phone, input.published, input.id, period]);
      return result.rows.length === 1;
    },
  };
}

// One local database across Next development reloads; never used on hosted builds.
const globalDatabase = globalThis as typeof globalThis & { patronLocalDatabase?: Promise<PGlite> };
export async function getLocalPatronDatabase() {
  if (process.env.NODE_ENV !== "development" || process.env.VERCEL || process.env.VERCEL_ENV)
    throw new Error("Local Patron storage is restricted to local development.");
  globalDatabase.patronLocalDatabase ??= (async () => {
    const db = new PGlite(path.join(process.cwd(), ".patron-data.local"));
    const existing = await db.query<{ table_name: string | null }>("select to_regclass('public.patron_members')::text as table_name");
    if (!existing.rows[0].table_name) {
      await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
      await db.exec(await readFile(path.join(process.cwd(), "supabase/patron/001_patrons.sql"), "utf8"));
    }
    const approval = await db.query("select 1 from information_schema.columns where table_schema='public' and table_name='patron_members' and column_name='approved_at'");
    if (!approval.rows.length) await db.exec(await readFile(path.join(process.cwd(), "supabase/patron/002_approval.sql"), "utf8"));
    const payments = await db.query<{ name: string | null }>("select to_regclass('public.patron_payments') as name");
    if (!payments.rows[0].name) await db.exec(await readFile(path.join(process.cwd(), "supabase/patron/003_payments.sql"), "utf8"));
    const paidApproval = await db.query("select 1 from pg_constraint where conrelid='public.patron_members'::regclass and conname='patron_approval_requires_payment'");
    if (!paidApproval.rows.length) await db.exec(await readFile(path.join(process.cwd(), "supabase/patron/004_paid_approval.sql"), "utf8"));
    return db;
  })().catch(error => { globalDatabase.patronLocalDatabase = undefined; throw error; });
  return globalDatabase.patronLocalDatabase;
}
export async function getLocalPatronStore() { return localPatronStore(await getLocalPatronDatabase()); }

import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export async function testDatabase() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../../supabase/gala-development/001_gala_backend.sql', import.meta.url), 'utf8'));
  const rpc = async (name, args) => (await db.query(`select ${name}(${args.map((_, i) => '$' + (i+1)).join(',')}) as result`, args)).rows[0].result;
  const store = {
    reserve: q => rpc('gala_reserve', [q.details.requestId, q.hash, JSON.stringify(q.details), q.amount, q.description, q.tier]),
    get: async id => (await db.query('select * from gala_orders where id=$1', [id])).rows[0],
    bind: (id, session) => rpc('gala_bind_checkout', [id,session]),
    apply: (id,session,state,payment,event) => rpc('gala_apply_payment',[id,session,state,payment,event]),
    pending: async () => (await db.query("select * from gala_orders where status in ('reserved','awaiting_payment') order by created_at")).rows,
  };
  return { db, store };
}

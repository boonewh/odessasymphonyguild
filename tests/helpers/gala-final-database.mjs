// Historical final-sender rehearsal stays pinned before its retirement in migration 014.
import { readFile, readdir } from 'node:fs/promises';
import { testDatabase } from './gala-database.mjs';
export async function finalDatabase(dataDir) {
  const ctx = await testDatabase(dataDir);
  const folder = new URL('../../supabase/gala-development/', import.meta.url);
  if (!(await ctx.db.query("select to_regclass('public.gala_final_total') as name")).rows[0].name) {
    for (const file of (await readdir(folder)).filter(n => /^0\d\d_.*\.sql$/.test(n) && !n.startsWith('001_') && Number(n.slice(0,3)) <= 13).sort())
      await ctx.db.exec(await readFile(new URL(file, folder), 'utf8'));
  }
  const rpc = async (name,args=[]) => (await ctx.db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;
  const totals = {
    current: async () => (await ctx.db.query('select * from gala_final_total')).rows[0] || null,
    freeze: (p,actor='sandbox-rehearsal') => rpc('gala_final_prepare',[p.id,p.revision,JSON.stringify(p.source),JSON.stringify(p.lines),JSON.stringify(p.mapping),JSON.stringify(p.payload),actor]),
    claim: (id,owner) => rpc('gala_final_claim',[id,owner]),
    prepare: async () => {throw new Error('Must be frozen');},
    dispatch: (id,owner) => rpc('gala_final_dispatch',[id,owner]),
    finish: (id,owner,receipt) => rpc('gala_final_finish',[id,owner,receipt]),
    review: (id,owner,code) => rpc('gala_final_review',[id,owner,code]),
  };
  return {...ctx,rpc,totals,snapshot:()=>rpc('gala_ledger_snapshot')};
}

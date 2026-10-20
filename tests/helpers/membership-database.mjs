// Disposable, fictional membership database. Never reads credentials or a dump.
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export const studentId = '11111111-1111-4111-8111-111111111111';
export async function membershipDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon,authenticated,service_role;
    -- Exercise permissive hosted-style defaults, not PGlite's quieter defaults.
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
  `);
  for (const file of [
    '001_create_students.sql', '002_create_qb_tokens.sql', '003_add_qb_payment_id.sql',
    '004_create_settings.sql', '005_add_guardians.sql', '006_add_media_release.sql',
    '007_lock_down_students_rls.sql', '008_add_late_fee.sql', '20260801165218_create_belles_beaux_interest_list.sql',
  ]) await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  await db.exec(`
    insert into students(id,school_year,first_name,last_name,cell_number,school,grade,gender,tshirt_size,
      membership_type,dues_amount,paid,guardian_1_name,guardian_1_email,qb_invoice_id)
    values('${studentId}','2026-2027','Offline','Student','4325550100','Fictional High School','12','F','M',
      'returning',300,true,'Offline Guardian','guardian@example.com','fictional_invoice');
    insert into qb_tokens(realm_id,access_token,refresh_token,expires_at,refresh_expires_at)
      values('fictional_realm','fictional_sealed_access','fictional_sealed_refresh','2027-01-01','2027-02-01');
    insert into belles_beaux_interests(interest_year,student_name,parent_name,school,parent_email,parent_phone)
      values('2027-2028','Offline Prospect','Offline Parent','Fictional School','parent@example.com','4325550101');
    update settings set value='325' where key='dues_returning';
    -- Unrelated objects with names resembling the Gala prefix must survive.
    create sequence public.galax_dues_sequence start 17;
    create view public.galax_dues_prices as select key,value from public.settings;
    grant select on public.galax_dues_prices to anon;
    create function public.membership_price(text) returns text language sql
      set search_path='' as 'select value from public.settings where key=$1';
    create function public.membership_price() returns text language sql as 'select ''unchanged''::text';
    grant execute on function public.membership_price(text),public.membership_price() to anon;
  `);
  return db;
}

export async function membershipSnapshot(db) {
  const result = {};
  for (const table of ['students','settings','qb_tokens','belles_beaux_interests']) {
    result[table] = (await db.query(`select * from public.${table} order by 1`)).rows;
  }
  for (const [name, query] of Object.entries({
    relations: `select oid,relname,relkind,relacl,relrowsecurity,relforcerowsecurity
      from pg_class where relnamespace='public'::regnamespace and left(relname,5)<>'gala_' order by oid`,
    columns: `select a.* from pg_attribute a join pg_class c on c.oid=a.attrelid
      where c.relnamespace='public'::regnamespace and left(c.relname,5)<>'gala_' order by a.attrelid,a.attnum`,
    constraints: `select con.* from pg_constraint con join pg_class c on c.oid=con.conrelid
      where c.relnamespace='public'::regnamespace and left(c.relname,5)<>'gala_' order by con.oid`,
    policies: `select * from pg_policies where schemaname='public' and left(tablename,5)<>'gala_' order by tablename,policyname`,
    functions: `select oid,proname,proacl,pg_get_functiondef(oid) as definition from pg_proc
      where pronamespace='public'::regnamespace and left(proname,5)<>'gala_' order by oid`,
    defaults: `select * from pg_default_acl order by oid`,
    schema: `select nspacl from pg_namespace where nspname='public'`,
    sequence: `select * from public.galax_dues_sequence`,
  })) result[name] = (await db.query(query)).rows;
  return result;
}

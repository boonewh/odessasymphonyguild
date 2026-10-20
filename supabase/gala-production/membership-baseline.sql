-- Read-only operator check, before AND after the authorized Gala installation.
-- Run on the existing production membership project. Save the result privately.
-- Contains counts/fingerprints, not student/guardian details or OAuth tokens.
-- A matching fingerprint is preservation evidence, NOT a backup.
begin transaction isolation level repeatable read read only;

with records as (select jsonb_build_object(
  'students', (select jsonb_build_object('count',count(*),'fingerprint',
    md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]'))) from public.students t),
  'settings', (select jsonb_build_object('count',count(*),'fingerprint',
    md5(coalesce(jsonb_agg(to_jsonb(t) order by key)::text,'[]'))) from public.settings t),
  'qb_tokens', (select jsonb_build_object('count',count(*),'fingerprint',
    md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]'))) from public.qb_tokens t),
  'interests', (select jsonb_build_object('count',count(*),'fingerprint',
    md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]'))) from public.belles_beaux_interests t)
) as membership_records),

-- Fingerprint unrelated public objects and permissions, including defaults.
-- Live Dues submissions/token refreshes can legitimately change record hashes;
-- investigate differences rather than overwriting or reverting membership data.
schema_state as (select md5(jsonb_build_object(
  'relations', (select jsonb_agg(jsonb_build_array(oid,relname,relkind,relacl,relrowsecurity,relforcerowsecurity) order by oid)
    from pg_class where relnamespace='public'::regnamespace and left(relname,5)<>'gala_'),
  'columns', (select jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum)
    from pg_attribute a join pg_class c on c.oid=a.attrelid
    where c.relnamespace='public'::regnamespace and left(c.relname,5)<>'gala_'),
  'constraints', (select jsonb_agg(to_jsonb(con) order by con.oid)
    from pg_constraint con join pg_class c on c.oid=con.conrelid
    where c.relnamespace='public'::regnamespace and left(c.relname,5)<>'gala_'),
  'policies', (select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p
    where schemaname='public' and left(tablename,5)<>'gala_'),
  'functions', (select jsonb_agg(jsonb_build_array(oid,proname,proacl,prosrc,proconfig,prosecdef) order by oid)
    from pg_proc where pronamespace='public'::regnamespace and left(proname,5)<>'gala_'),
  'defaults', (select jsonb_agg(to_jsonb(d) order by oid) from pg_default_acl d),
  'schema', (select nspacl from pg_namespace where nspname='public')
)::text) as membership_schema_fingerprint),

gala_objects as (select kind,name from (
  select 'relation' as kind,relname as name from pg_class
    where relnamespace='public'::regnamespace and left(relname,5)='gala_'
  union all
  select 'function',proname from pg_proc
    where pronamespace='public'::regnamespace and left(proname,5)='gala_'
  union all
  select 'type',typname from pg_type
    where typnamespace='public'::regnamespace and left(typname,5)='gala_'
) objects)
select jsonb_build_object(
  'membership_records', records.membership_records,
  'membership_schema_fingerprint', schema_state.membership_schema_fingerprint,
  'gala_objects', (select coalesce(jsonb_agg(to_jsonb(o) order by kind,name),'[]') from gala_objects o),
  'membership_columns', (select jsonb_agg(jsonb_build_array(table_name,column_name,data_type,is_nullable) order by table_name,ordinal_position)
    from information_schema.columns where table_schema='public'
      and table_name in ('students','settings','qb_tokens','belles_beaux_interests'))
) as installation_baseline from records cross join schema_state;

commit;

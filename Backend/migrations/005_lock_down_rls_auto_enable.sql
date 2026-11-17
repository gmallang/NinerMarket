-- 005 - stop the anon key from calling public.rls_auto_enable() over the API.
--
-- Supabase ships rls_auto_enable() (fired by an event trigger) so new tables
-- get row level security automatically. PostgREST exposes every function in
-- the `public` schema as POST /rest/v1/rpc/<name>, and functions grant EXECUTE
-- to PUBLIC by default, so the anon key that ships in the frontend bundle -
-- public by definition - can invoke it. It is a helper, not an API: nothing in
-- the app calls it, and the DDL paths that do run as postgres, which keeps
-- EXECUTE as the owner.
--
-- Guarded so this is a no-op on a database without the helper (a plain
-- Postgres project, or a future Supabase where it was removed), and idempotent
-- if re-run.
--
-- The matching block also lives at the end of ../schema.sql, so a fresh
-- database ends up in the same state as one that had this applied.
--
-- Note for reviewers: the function stays in the PostgREST OpenAPI listing
-- after the revoke, because the schema cache still knows it exists; the call
-- itself answers 401/403 for anon and authenticated. Reloading the cache
-- keeps the listing from outliving the grant.

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and p.pronargs = 0
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

notify pgrst, 'reload schema';

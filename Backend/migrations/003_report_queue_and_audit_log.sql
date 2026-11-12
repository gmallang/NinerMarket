-- 003 - report resolution state and the admin audit log.
--
-- listing_reports gained a resolution state so reports form a queue instead of
-- being a fire-and-forget signal; existing reports stay 'open' until a
-- moderator resolves them.
--
-- admin_actions is append-only and intentionally has no foreign keys: the log
-- has to survive the deletion or closure of the thing it describes.
--
-- Idempotent: safe to re-run.

alter table listing_reports add column if not exists status text not null default 'open';
alter table listing_reports add column if not exists resolved_at timestamptz;
alter table listing_reports add column if not exists resolved_by text not null default '';

create table if not exists admin_actions (
  id           text primary key,
  admin_id     text not null default '',
  admin_email  text not null default '',
  action       text not null,
  target_type  text not null,
  target_id    text not null default '',
  target_label text not null default '',
  details      text not null default '',
  created_at   timestamptz not null default now()
);

-- The report queue's default view is "open, newest first".
create index if not exists idx_listing_reports_status_created
  on listing_reports (status, created_at desc);
create index if not exists idx_admin_actions_created_at on admin_actions (created_at desc);

-- New table: RLS on with zero policies, matching every other table (the
-- service_role key used by the backend bypasses it; anon gets nothing).
alter table admin_actions enable row level security;

notify pgrst, 'reload schema';

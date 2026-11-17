-- 004 - native app push (FCM) device tokens.
--
-- The wrapped iOS/Android app can't use the browser Push API, so it registers
-- an FCM token instead. One opaque token per row; a device re-registering
-- upserts on token, so a rotated or reinstalled token doesn't pile up.
--
-- Idempotent: safe to re-run.

create table if not exists push_tokens (
  token      text primary key,
  user_id    text not null references users(id) on delete cascade,
  platform   text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now()
);

create index if not exists idx_push_tokens_user_id on push_tokens (user_id);

alter table push_tokens enable row level security;

notify pgrst, 'reload schema';

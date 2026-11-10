-- NinerMarket schema for Supabase.
-- Run this in Supabase Dashboard > SQL Editor.
--
-- The backend API uses the service_role key (SUPABASE_KEY in Backend env) so it
-- can read/write these tables regardless of RLS - service_role always bypasses
-- it. Never expose that key to the frontend.
--
-- The frontend only ever holds the anon key (SUPABASE_ANON_KEY / the Vite-side
-- VITE_SUPABASE_ANON_KEY), which is necessarily public - it ships in the built
-- JS bundle for anyone to read. Its one legitimate job is subscribing to
-- Realtime broadcast channels (see lib/realtime.ts and Backend/broadcast.py),
-- which doesn't touch tables and isn't affected by RLS at all. Every table
-- below has RLS enabled with zero policies for anon/authenticated, so holding
-- the anon key grants no direct read or write access to anything through
-- Supabase's own REST API - every request still has to go through the FastAPI
-- backend's own auth, validation, and rate limits.

create table if not exists users (
  id                    text primary key,
  email                 text not null unique,
  display_name          text not null,
  school_year           text not null default '',
  payment_methods       jsonb not null default '[]'::jsonb,
  rating_avg            double precision not null default 0,
  rating_count          integer not null default 0,
  password_hash         text not null default '',
  email_verified        boolean not null default false,
  verification_code     text not null default '',
  verification_expires  timestamptz,
  password_reset_code   text not null default '',
  password_reset_expires timestamptz
);

-- Migration for databases created before the password-reset fields existed.
alter table users add column if not exists password_reset_code text not null default '';
alter table users add column if not exists password_reset_expires timestamptz;

create table if not exists listings (
  id               text primary key,
  seller_id        text not null references users(id) on delete cascade,
  name             text not null,
  price            double precision not null,
  category         text not null,
  condition        text not null default '',
  description      text not null default '',
  status           text not null default 'active',
  flag_reason      text not null default '',
  photos           jsonb not null default '[]'::jsonb,
  photos_small     jsonb not null default '[]'::jsonb,
  pickup_location  text not null default '',
  created_at       timestamptz not null default now(),
  sold_at          timestamptz
);

-- Migration for databases created before sold_at existed.
alter table listings add column if not exists sold_at timestamptz;
-- Migration for databases created before photos_small existed.
alter table listings add column if not exists photos_small jsonb not null default '[]'::jsonb;

create table if not exists ratings (
  id           text primary key,
  rater_id     text not null references users(id) on delete cascade,
  ratee_id     text not null references users(id) on delete cascade,
  listing_id   text not null default '',
  stars        integer not null check (stars between 1 and 5),
  comment      text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists threads (
  id              text primary key,
  user_id         text not null references users(id) on delete cascade,
  "listingId"     text not null default '',
  name            text not null default '',
  avatar          text not null default '',
  online          boolean not null default true,
  unread          integer not null default 0,
  "lastMsg"       text not null default '',
  "lastTimestamp" timestamptz not null default now()
);

create table if not exists messages (
  id         bigint primary key,
  thread_id  text not null references threads(id) on delete cascade,
  text       text not null,
  sent       boolean not null default true,
  timestamp  timestamptz not null default now()
);

-- Per-participant read cursors (the "only notify if not seen" pattern):
-- each member's last_read_msg_id is the highest message id they've viewed.
-- Unread = count of messages with id above that cursor. Cursors only ever
-- move forward (monotonic), so stale devices can't resurrect old unread.
create table if not exists thread_members (
  thread_id       text not null references threads(id) on delete cascade,
  user_id         text not null references users(id) on delete cascade,
  last_read_msg_id bigint not null default 0,
  primary key (thread_id, user_id)
);

create table if not exists notifications (
  id                 text primary key,
  user_id            text not null references users(id) on delete cascade,
  text               text not null,
  listing_id         text not null default '',
  related_user_id    text not null default '',
  related_user_name  text not null default '',
  created_at         timestamptz not null default now(),
  read               boolean not null default false
);

-- Migration for databases created before related_user_id/related_user_name existed.
alter table notifications add column if not exists related_user_id text not null default '';
alter table notifications add column if not exists related_user_name text not null default '';

-- Web Push subscriptions (Push API). One row per browser/device a user has
-- granted notification permission on; a user can have several (phone,
-- laptop, etc). endpoint is unique per browser subscription, so upserting on
-- it naturally replaces a stale subscription for the same device.
create table if not exists push_subscriptions (
  endpoint   text primary key,
  user_id    text not null references users(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create table if not exists listing_reports (
  id           text primary key,
  listing_id   text not null references listings(id) on delete cascade,
  reporter_id  text not null references users(id) on delete cascade,
  reason       text not null,
  details      text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists offers (
  id          text primary key,
  listing_id  text not null references listings(id) on delete cascade,
  buyer_id    text not null references users(id) on delete cascade,
  price       double precision not null check (price > 0),
  status      text not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- A user's saved/wishlist items. One row per (user, listing); a composite
-- primary key keeps duplicates impossible and makes toggle lookups a point
-- query. Listed items can be deleted, so cascade removes stale saves too.
create table if not exists saved_listings (
  user_id     text not null references users(id) on delete cascade,
  listing_id  text not null references listings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- "Looking For" requests. Kept separate from listings: a request has a budget
-- range and expires, and must never show up in the marketplace grid.
create table if not exists wanted_requests (
  id                  text primary key,
  user_id             text not null references users(id) on delete cascade,
  title               text not null,
  description         text not null default '',
  category            text not null,
  budget_min          double precision,
  budget_max          double precision,
  preferred_location  text not null default '',
  photos              jsonb not null default '[]'::jsonb,
  -- active | fulfilled. Expiry is derived from expires_at, not stored, so a
  -- stale row can never look active just because a cron job didn't run.
  status              text not null default 'active',
  expires_at          timestamptz not null default (now() + interval '30 days'),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- One row per (requester, responder, request): responding twice reuses the
-- first row instead of piling up duplicates.
create table if not exists wanted_request_responses (
  id             text primary key,
  request_id     text not null references wanted_requests(id) on delete cascade,
  responder_id   text not null references users(id) on delete cascade,
  conversation_id text not null default '',
  created_at     timestamptz not null default now()
);

create index if not exists idx_listings_seller_id on listings (seller_id);
create index if not exists idx_listings_category on listings (category);
create index if not exists idx_listings_status on listings (status);
create index if not exists idx_ratings_ratee_id on ratings (ratee_id);
-- One rating per rater/ratee pair. If a live database already contains
-- duplicates, delete them before applying this index.
create unique index if not exists idx_ratings_rater_ratee on ratings (rater_id, ratee_id);
create index if not exists idx_threads_user_id on threads (user_id);
create index if not exists idx_threads_listing_id on threads ("listingId");
create index if not exists idx_messages_thread_id on messages (thread_id);
-- Composite index for the per-thread unread/cursor queries, which filter by
-- thread_id and then order/compare on id (idx_messages_thread_id alone can't
-- satisfy the id ordering without an extra sort).
create index if not exists idx_messages_thread_id_id on messages (thread_id, id);
create index if not exists idx_thread_members_user_id on thread_members (user_id);
create index if not exists idx_notifications_user_id on notifications (user_id);
create index if not exists idx_push_subscriptions_user_id on push_subscriptions (user_id);
create index if not exists idx_listing_reports_listing_id on listing_reports (listing_id);
create index if not exists idx_listing_reports_reporter_id on listing_reports (reporter_id);
create index if not exists idx_offers_listing_id on offers (listing_id);
create index if not exists idx_offers_buyer_id on offers (buyer_id);
create index if not exists idx_offers_status on offers (status);
-- Composite index for the common "does buyer have a pending offer on this listing?" check.
create index if not exists idx_offers_listing_buyer_status on offers (listing_id, buyer_id, status);
-- Feed query: active requests in a category, newest first.
create index if not exists idx_wanted_requests_feed on wanted_requests (status, category, created_at desc);
create index if not exists idx_wanted_requests_user_id on wanted_requests (user_id);
create index if not exists idx_wanted_requests_expires_at on wanted_requests (expires_at);
-- Response dedupe + "how many people responded" badge lookups.
create unique index if not exists idx_wanted_response_pair
  on wanted_request_responses (request_id, responder_id);
create index if not exists idx_wanted_response_request_id on wanted_request_responses (request_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Enabled with zero policies on every table, on purpose: the only key the
-- frontend ever holds (anon) is meant to be public, and its one real job
-- (Realtime broadcast) is a pub/sub layer that doesn't read tables at all. No
-- policy means anon/authenticated get zero rows on every operation - the
-- backend's service_role key bypasses RLS entirely by design, so this changes
-- nothing for the app itself, only for anyone who extracts the anon key from
-- the frontend bundle and tries to query Supabase directly.
alter table users enable row level security;
alter table listings enable row level security;
alter table ratings enable row level security;
alter table threads enable row level security;
alter table messages enable row level security;
alter table thread_members enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;
alter table listing_reports enable row level security;
alter table offers enable row level security;
alter table saved_listings enable row level security;
alter table wanted_requests enable row level security;
alter table wanted_request_responses enable row level security;


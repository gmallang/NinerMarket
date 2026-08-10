-- NinerMarket schema for Supabase.
-- Run this in Supabase Dashboard > SQL Editor.
--
-- The backend API uses the service_role key (SUPABASE_KEY in Backend env) so it
-- can read/write these tables without RLS policies. Never expose that key to the
-- frontend. If you prefer the anon key instead, enable RLS and add permissive
-- policies, or none of the queries will work.

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
  verification_expires  timestamptz
);

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
  pickup_location  text not null default '',
  created_at       timestamptz not null default now()
);

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

create table if not exists notifications (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  text        text not null,
  listing_id  text not null default '',
  created_at  timestamptz not null default now(),
  read        boolean not null default false
);

create index if not exists idx_listings_seller_id on listings (seller_id);
create index if not exists idx_ratings_ratee_id on ratings (ratee_id);
create index if not exists idx_threads_user_id on threads (user_id);
create index if not exists idx_messages_thread_id on messages (thread_id);
create index if not exists idx_notifications_user_id on notifications (user_id);

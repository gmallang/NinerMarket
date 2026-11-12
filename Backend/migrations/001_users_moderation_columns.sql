-- 001 - review-only posting columns on users.
--
-- These three were added to the User model and to schema.sql in the same
-- change, but production was only partially migrated. Because _save_user
-- upserts the whole model, their absence made EVERY users write fail - signup,
-- Google sign-in, email verification, password reset - while reads kept
-- working (jsonb/pydantic defaults hid the gap). Applied 2026-11-11.
--
-- Idempotent: safe to re-run.

alter table users add column if not exists posting_flagged boolean not null default false;
alter table users add column if not exists flag_reason text not null default '';
alter table users add column if not exists bad_listing_streak integer not null default 0;

-- PostgREST caches the schema; without this a column can exist and still be
-- reported as missing by the API.
notify pgrst, 'reload schema';

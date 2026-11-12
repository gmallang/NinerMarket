-- 002 - soft delete for closed accounts.
--
-- Closing an account sets users.deleted_at instead of deleting the row, so the
-- admin panel's Deleted tab can restore it. The account's listings and requests
-- are hidden through their own deleted_at rather than being destroyed.
--
-- Idempotent: safe to re-run.

alter table users add column if not exists deleted_at timestamptz;
alter table listings add column if not exists deleted_at timestamptz;
alter table wanted_requests add column if not exists deleted_at timestamptz;

notify pgrst, 'reload schema';

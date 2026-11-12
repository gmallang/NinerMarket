# Database migrations

`schema.sql` is the **baseline**: it creates every table from scratch and is
idempotent. These numbered files are the **deltas** applied to a database that
already exists, in ascending order, exactly once each.

The 2026-11-11 outage happened because that distinction was informal: production
had received part of a change, nothing recorded which part, and no check
noticed the gap until every sign-in failed. Adding a migration here is now part
of changing the schema.

## Rule for every schema change

1. Add the delta here as the next number (`004_...sql`), idempotent
   (`if not exists` / `add column if not exists`) so a re-run is harmless.
2. Add the same statements to `schema.sql`, so a fresh database is still
   created completely in one file.
3. Add any new table/column to `EXPECTED` in `../schema_check.py`.
4. Apply it, then verify:

   ```bash
   cd Backend
   python schema_check.py     # exit 1 lists every table/column still missing
   ```

   The backend's `GET /readyz` runs the same check (cached for 5 minutes) and
   returns 503 while the schema is behind, so a deploy that arrives before its
   migration fails loudly instead of 500-ing on the first write.
5. Every file ends with `notify pgrst, 'reload schema';`. PostgREST caches the
   schema, and a column that exists but is not in the cache still answers
   `42703 column ... does not exist`.

## Applied history

| # | File | Contents | Applied to production |
|---|---|---|---|
| 001 | `001_users_moderation_columns.sql` | `users.posting_flagged`, `flag_reason`, `bad_listing_streak` | 2026-11-11 |
| 002 | `002_account_soft_delete.sql` | `deleted_at` on `users`, `listings`, `wanted_requests` | 2026-11-11 |
| 003 | `003_report_queue_and_audit_log.sql` | report `status` / `resolved_at` / `resolved_by`, `admin_actions` | 2026-11-11 |

`schema_check.py` is the source of truth for what is actually applied - the
dates above are when the delta was last run, not a promise about the live
project.

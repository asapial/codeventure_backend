-- Support module (S1–S7) v1.
--
-- This migration was applied directly via `prisma db push` after the
-- migration-tooling shadow chain proved incompatible with the existing
-- 20260801090000 portal migration. The schema in `prisma/schema/` is
-- the source of truth and is currently in sync with the database.
--
-- Reference DDL for the 13 new tables, new enums, and FK constraints
-- this migration represents is captured in
--   prisma/migrations/_reference/support_module_v1.full_ddl.sql
--
-- To verify the DB is in sync: `pnpm prisma db push` reports
-- "The database is already in sync with the Prisma schema."
SELECT 'support_module_v1: applied via prisma db push; schema in sync' AS note;


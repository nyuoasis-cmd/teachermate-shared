-- Full RLS policy audit fixes — project jblkbztpbwqidfvmmoey, 2026-05-28.
--
-- Audited all policies with non-scoping qual (true / role-only) bound to public/anon/authenticated.
-- Classified as: intentional public reference data (KEPT) vs real exposure (FIXED below).
--
-- KEPT (intentional public reads of non-sensitive reference/educational data):
--   kospi_prices, kospi_symbols, kospi_cases, kospi_npc_personas (stock-sim content),
--   templates ("Anyone can read templates"), ai_app_builder_apps.apps_public_read (is_published=true only).
--
-- FIXED (real exposures; all 4 tables are server-only — 0 client `.from()`/realtime refs,
--   every backend uses service_role which bypasses RLS):
--   1. ai_app_builder_apps "Allow all for service role" — name says service_role but bound to
--      {public} with qual true => anon could read UNPUBLISHED apps (student_name, html_content,
--      react_payload, conversation) AND write/delete all. Verified: anon read 5/5 unpublished.
--      Drop it; legit public access stays via apps_public_read (published only).
--   2. ai_app_builder_sessions "Allow all for service role" — same misbinding, sole policy.
--      Verified anon read 3 rows. Drop => deny-all to non-service_role.
--   3. mv_groups "mv_groups_all" — {anon} ALL true => anon read/write/delete all groups.
--      Keep teacher_own_groups (session-owner scoped). (NB: mv_sessions has a separate
--      infinite-recursion RLS bug surfacing as 42P17 on anon reads — flagged, not fixed here.)
--   4. group_proposals read/write/update/delete — all {public} true/null => anon full CRUD.
--      Server-only (sprint via service_role); verified anon read 3 rows. Drop all 4.
--
-- Rollback: recreate the dropped policies (definitions recorded in git history of this commit).

BEGIN;

DROP POLICY IF EXISTS "Allow all for service role" ON public.ai_app_builder_apps;
DROP POLICY IF EXISTS "Allow all for service role" ON public.ai_app_builder_sessions;
DROP POLICY IF EXISTS "mv_groups_all"              ON public.mv_groups;
DROP POLICY IF EXISTS "group_proposals_read"       ON public.group_proposals;
DROP POLICY IF EXISTS "group_proposals_write"      ON public.group_proposals;
DROP POLICY IF EXISTS "group_proposals_update"     ON public.group_proposals;
DROP POLICY IF EXISTS "group_proposals_delete"     ON public.group_proposals;

COMMIT;

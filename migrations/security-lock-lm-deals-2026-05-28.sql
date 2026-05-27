-- Security fix: lock down public.lm_deals (lecture-manager business/financial data)
-- project jblkbztpbwqidfvmmoey, 2026-05-28.
--
-- Problem: lm_deals had policy "auth read deals" = USING (auth.role() = 'authenticated'),
-- bound to {public}. Because auth is SHARED across 14 teachermate services, ANY logged-in
-- user (incl. students on sprint/kospi/etc.) could read all 20 rows of deal data
-- (school_id, status, 차시/입금 amounts) via the REST API. Verified HTTP 200 with a user JWT.
-- lm_deals has no user_id column, so per-owner scoping isn't possible here.
--
-- Context: lm_deals is server-only — populated by ananda sync + lecture-manager server
-- (service_role); 0 client-side `.from('lm_deals')` references. RLS already ENABLED.
--
-- Fix: drop the permissive policy => deny-all for anon/authenticated, service_role bypasses.
-- Rollback: recreate policy
--   CREATE POLICY "auth read deals" ON public.lm_deals FOR SELECT TO public
--     USING (auth.role() = 'authenticated');

BEGIN;

DROP POLICY IF EXISTS "auth read deals" ON public.lm_deals;

COMMIT;

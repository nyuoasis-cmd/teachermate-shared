-- Security fix: enable RLS on 20 public tables flagged by Supabase advisor
-- (rls_disabled_in_public + exposed sensitive columns), project jblkbztpbwqidfvmmoey.
--
-- Context: all 20 tables are server-only. Confirmed (2026-05-28):
--   - 0 client-side `.from()` or string references across all projects
--   - every backend uses SUPABASE_SERVICE_ROLE_KEY (service_role bypasses RLS)
--   - anon key (public, shipped in client bundle) could read PII from
--     contact_inquiries (name/school/phone/email/message) — verified HTTP 200.
--
-- Fix: ENABLE RLS with NO policies => deny-all for anon/authenticated,
-- service_role unaffected. Closes the hole without breaking any app.
-- Rollback: ALTER TABLE public.<t> DISABLE ROW LEVEL SECURITY;

BEGIN;

ALTER TABLE public.ai_app_builder_session_tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_maker_apps                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_maker_sessions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_config                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiries                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_sets                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_usage                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plan_outputs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_question_sets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_votes                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ox_question_sets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_members                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_sessions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_teams                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_vote_sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_votes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_worksheets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toolkit_generation_usage         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_cache                ENABLE ROW LEVEL SECURITY;

COMMIT;

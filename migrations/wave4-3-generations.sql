CREATE TABLE IF NOT EXISTS ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid,
  session_id uuid NOT NULL,
  app text NOT NULL,
  model text NOT NULL,
  prompt_text text,
  prompt_hash text,
  result_url text,
  license text DEFAULT 'CC BY-NC-SA 4.0',
  is_public boolean DEFAULT false,
  is_hidden boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gen_session ON ai_generations(session_id);
CREATE INDEX IF NOT EXISTS idx_gen_student_active ON ai_generations(student_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gen_deleted_recent ON ai_generations(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gen_prompt_hash ON ai_generations(prompt_hash) WHERE deleted_at IS NULL;

ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gen_insert_service" ON ai_generations;
DROP POLICY IF EXISTS "gen_select_public_active" ON ai_generations;
DROP POLICY IF EXISTS "gen_select_self_active" ON ai_generations;

CREATE POLICY "gen_insert_service" ON ai_generations FOR INSERT WITH CHECK (true);
CREATE POLICY "gen_select_public_active" ON ai_generations FOR SELECT
  USING (is_public = true AND is_hidden = false AND deleted_at IS NULL);
CREATE POLICY "gen_select_self_active" ON ai_generations FOR SELECT
  USING (student_id = auth.uid() AND deleted_at IS NULL);

CREATE TABLE IF NOT EXISTS ai_quota_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid,
  school text,
  app text NOT NULL,
  month text NOT NULL,
  usage_count int DEFAULT 0,
  limit_count int DEFAULT 1000,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE (user_id, app, month)
);

CREATE INDEX IF NOT EXISTS idx_quota_user_month ON ai_quota_usage(user_id, month);

ALTER TABLE ai_quota_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quota_select_self" ON ai_quota_usage;
DROP POLICY IF EXISTS "quota_insert_service" ON ai_quota_usage;
DROP POLICY IF EXISTS "quota_update_service" ON ai_quota_usage;

CREATE POLICY "quota_select_self" ON ai_quota_usage FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "quota_insert_service" ON ai_quota_usage FOR INSERT WITH CHECK (true);
CREATE POLICY "quota_update_service" ON ai_quota_usage FOR UPDATE USING (true);

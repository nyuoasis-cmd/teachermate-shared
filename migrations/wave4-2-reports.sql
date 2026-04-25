CREATE TABLE IF NOT EXISTS content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('creation')),
  target_id uuid NOT NULL,
  reporter_id uuid,
  reporter_ip text,
  reporter_email text,
  notify_reporter boolean DEFAULT false,
  notify_channel text,
  consent_notified_at timestamptz,
  category text NOT NULL CHECK (category IN ('violence','sexual','hate','self-harm','personal-info','other')),
  description text,
  auto_moderation_result jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending','reviewing','resolved','rejected')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON content_reports(target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON content_reports(status);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_all" ON content_reports;
DROP POLICY IF EXISTS "reports_select_self_or_service" ON content_reports;

CREATE POLICY "reports_insert_all" ON content_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "reports_select_self_or_service" ON content_reports FOR SELECT
  USING (reporter_id = auth.uid());

-- Codify orphan: transcript_tag_assignments table + RLS policies.
--
-- Exists in prod with no defining migration (created via unrecorded hotfix).
-- Captured from prod via pg_attribute / pg_constraint / pg_policy on
-- 2026-06-11 during the fresh-replay repair of the migration chain.
-- Idempotent: IF NOT EXISTS / guarded policy creation — no-op on prod.
--
-- Refs:
--   - 20260528070300_codify_ai_processing_jobs_updated_at.sql (same pattern)
--   - src/test/rls-regression.test.ts (CROSS_ORG_TABLES exercises this table)

CREATE TABLE IF NOT EXISTS public.transcript_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID NOT NULL REFERENCES transcript_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE
);

ALTER TABLE public.transcript_tag_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.transcript_tag_assignments'::regclass
      AND polname = 'Users can read tag assignments for own calls'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can read tag assignments for own calls"
        ON transcript_tag_assignments FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM recordings r
            WHERE r.id = transcript_tag_assignments.recording_id
              AND r.owner_user_id = auth.uid()
          )
        )
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.transcript_tag_assignments'::regclass
      AND polname = 'Users can manage tag assignments for own calls'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can manage tag assignments for own calls"
        ON transcript_tag_assignments FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM recordings r
            WHERE r.id = transcript_tag_assignments.recording_id
              AND r.owner_user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM recordings r
            WHERE r.id = transcript_tag_assignments.recording_id
              AND r.owner_user_id = auth.uid()
          )
        )
    $pol$;
  END IF;
END $$;

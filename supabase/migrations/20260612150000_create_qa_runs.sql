-- Migration: create_qa_runs (16-03 / ADMC-05)
-- QA crawler run ledger. The nightly crawler (autopilot qa/) writes one summary
-- row per crawl via the service-role client; the Admin Center QA section reads
-- them (admin-only SELECT). Same append-only posture as admin_audit_log:
--   * No client-reachable INSERT/UPDATE/DELETE policies — rows are written
--     exclusively from the crawler using the service-role key (bypasses RLS).
--   * SELECT is admin-only via public.has_role (SECURITY DEFINER, no RLS
--     recursion).
--
-- Column contract matches the ported QaRun TS interface (src/services/qa.service.ts):
--   id, started_at, finished_at, status, routes_crawled, findings_count,
--   critical_count, report (jsonb summary), triggered_by.

CREATE TABLE IF NOT EXISTS public.qa_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    status text NOT NULL DEFAULT 'completed'
        CHECK (status IN ('running', 'completed', 'failed')),
    routes_crawled integer NOT NULL DEFAULT 0,
    findings_count integer NOT NULL DEFAULT 0,
    critical_count integer NOT NULL DEFAULT 0,
    report jsonb NOT NULL DEFAULT '{}'::jsonb,
    triggered_by text NOT NULL DEFAULT 'nightly',
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_runs ENABLE ROW LEVEL SECURITY;

-- Admin-only read. has_role is SECURITY DEFINER (no RLS recursion).
DROP POLICY IF EXISTS "Admins can read qa runs" ON public.qa_runs;
CREATE POLICY "Admins can read qa runs"
    ON public.qa_runs FOR SELECT
    USING (public.has_role(auth.uid(), 'ADMIN'));

-- No INSERT/UPDATE/DELETE policies on purpose: the crawler writes with the
-- service-role key (RLS-exempt). No client-reachable path may forge a run row.

CREATE INDEX IF NOT EXISTS idx_qa_runs_started_at
    ON public.qa_runs (started_at DESC);

COMMENT ON TABLE public.qa_runs IS
    'Append-only ledger of QA crawler runs. One row per nightly crawl, written via service-role from the autopilot qa/ crawler; admin-only read. Surfaced in the Admin Center QA section.';
COMMENT ON COLUMN public.qa_runs.status IS
    'running while a crawl is in flight, completed on clean finish, failed if the crawler errored.';
COMMENT ON COLUMN public.qa_runs.report IS
    'JSON summary of the run (app_url, controls_clicked, and a findings[] array of {route,type,severity,message,selector}). Never contains secrets.';
COMMENT ON COLUMN public.qa_runs.triggered_by IS
    'Origin of the run: nightly (launchd schedule) or manual.';

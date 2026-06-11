import { supabase } from "@/integrations/supabase/client";

/**
 * QA crawler run ledger (16-03 / ADMC-05). Ported from worktree-admin-center.
 *
 * Matches the live `qa_runs` table (migration 20260612150000):
 * admin-only SELECT; rows are written exclusively by the autopilot QA crawler
 * via the service-role key (no client write path).
 */
export interface QaRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "completed" | "failed";
  routes_crawled: number;
  findings_count: number;
  critical_count: number;
  report: Record<string, unknown> | null;
  triggered_by: string;
}

export async function fetchQaRuns(limit = 20): Promise<QaRun[]> {
  const { data, error } = await supabase
    .from("qa_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as QaRun[];
}

export async function fetchLatestQaRun(): Promise<QaRun | null> {
  const { data, error } = await supabase
    .from("qa_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  const rows = (data ?? []) as QaRun[];
  return rows[0] ?? null;
}

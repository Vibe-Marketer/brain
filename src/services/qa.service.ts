import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/supabase";

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
  status: "requested" | "running" | "completed" | "failed";
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

/**
 * Queue a QA scan request. Inserts a `requested` placeholder row (gated by the
 * admin-only INSERT policy, which forces status='requested' +
 * triggered_by='admin-request'). The nightly crawler claims requested rows and
 * overwrites them with real results. This is the honest "Request scan" path —
 * no remote runner exists to fire a crawl synchronously from the browser.
 */
export async function requestQaRun(): Promise<void> {
  const { error } = await supabase.from("qa_runs").insert({
    status: "requested",
    triggered_by: "admin-request",
  });

  if (error) throw error;
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

/* ------------------------------------------------------------------ */
/* QA findings ledger (Phase 20 / QA-03, QA-04)                        */
/*                                                                      */
/* Durable, admin-readable ledger of non-ticketed and promoted nightly */
/* QA findings (migration 20260613235000). The autopilot crawler writes */
/* rows via the service-role key; the browser can only SELECT through    */
/* the admin RLS policy. These are PURE reads — no write path here, per  */
/* the threat register (T-20-20). The review lane stays auditable but is  */
/* never surfaced as a raw operator problem (D-07).                      */
/* ------------------------------------------------------------------ */

/** Lanes a QA finding can live in. Mirrors the DB CHECK constraint. */
export type QaFindingLane = "quarantined" | "qa_review" | "promoted" | "ignored_noise";

/** The lanes shown as audit/triage state in the admin QA surface. */
export const QA_FINDING_LANES: readonly QaFindingLane[] = [
  "quarantined",
  "qa_review",
  "promoted",
  "ignored_noise",
] as const;

/** A single QA finding row, derived from the generated DB types. */
export type QaFinding = Database["public"]["Tables"]["qa_findings"]["Row"];

/** Per-lane counts plus the latest review-lane rows, for the QA admin surface. */
export interface QaFindingSummary {
  counts: Record<QaFindingLane, number>;
  latestReview: QaFinding[];
}

/** Default number of latest review rows to surface in the summary. */
const DEFAULT_REVIEW_ROWS = 10;
/** Hard ceiling on rows pulled for the summary scan (T-20-23 DoS guard). */
const SUMMARY_SCAN_LIMIT = 500;

/**
 * Read QA findings in a single lane, newest-first, bounded by `limit`.
 * Pure async read — no React, no writes.
 */
export async function fetchQaFindings(opts: {
  lane: QaFindingLane;
  limit?: number;
}): Promise<QaFinding[]> {
  const { lane, limit = DEFAULT_REVIEW_ROWS } = opts;
  const { data, error } = await supabase
    .from("qa_findings")
    .select("*")
    .eq("lane", lane)
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as QaFinding[];
}

/**
 * Read a bounded, newest-first slice of QA findings and reduce it to per-lane
 * counts plus the latest review-lane rows. One round trip; counts reflect the
 * scanned window (capped at `SUMMARY_SCAN_LIMIT`) rather than the full table —
 * a deliberate DoS guard for the admin surface.
 */
export async function fetchQaFindingSummary(
  reviewRows = DEFAULT_REVIEW_ROWS,
): Promise<QaFindingSummary> {
  const { data, error } = await supabase
    .from("qa_findings")
    .select("*")
    .order("last_seen_at", { ascending: false })
    .limit(SUMMARY_SCAN_LIMIT);

  if (error) throw error;

  const rows = (data ?? []) as QaFinding[];
  const counts: Record<QaFindingLane, number> = {
    quarantined: 0,
    qa_review: 0,
    promoted: 0,
    ignored_noise: 0,
  };
  const latestReview: QaFinding[] = [];

  for (const row of rows) {
    if ((QA_FINDING_LANES as readonly string[]).includes(row.lane)) {
      counts[row.lane as QaFindingLane] += 1;
    }
    if (row.lane === "qa_review" && latestReview.length < reviewRows) {
      latestReview.push(row);
    }
  }

  return { counts, latestReview };
}

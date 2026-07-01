import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * FAIL-01 RED — SyncJobBanner precise partial-success breakdown.
 *
 * Phase 27 made partial-success failures visible + sticky. FAIL-01 (Phase 29)
 * requires the completed_with_errors banner to render the PRECISE breakdown
 * "{synced} of {requested} imported, {failed} failed" from the job's own counts,
 * distinguishing SKIPPED (already-synced duplicates — informational) from FAILED
 * (genuine, retryable errors).
 *
 * These assertions FAIL against the current banner, whose copy is the vague
 * "{synced} synced, {failed} failed" (no "of"/"imported"/"skipped"). RED is the
 * correct state for Task 1.
 *
 * Counts derive from `.length` on the TEXT[] arrays + numeric progress_total /
 * skipped_count only — never parseInt/Number (dual-ID rule, src/CLAUDE.md).
 */

import { SyncJobBanner } from "../SyncJobBanner";
import type { SyncJob } from "@/hooks/useSyncJobs";

function makeJob(overrides: Partial<SyncJob>): SyncJob {
  return {
    id: "job-1",
    user_id: "user-1",
    status: "completed_with_errors",
    created_at: "2026-06-30T00:00:00Z",
    updated_at: "2026-06-30T00:00:00Z",
    completed_at: "2026-06-30T00:01:00Z",
    error: null,
    recording_ids: null,
    synced_ids: null,
    failed_ids: null,
    progress_current: 0,
    progress_total: 0,
    source_app: "zoom",
    organization_id: "org-1",
    ...overrides,
  };
}

/** N distinct opaque string ids — never numbers (dual-ID rule). */
function ids(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i}`);
}

describe("SyncJobBanner FAIL-01 breakdown", () => {
  it("renders '18 of 30 imported, 12 failed' for a partial-success job", () => {
    const job = makeJob({
      id: "partial-1",
      progress_total: 30,
      synced_ids: ids("s", 18),
      failed_ids: ids("f", 12),
      skipped_count: 0,
    });

    const { container } = render(
      <SyncJobBanner job={job} onDismiss={vi.fn()} />,
    );

    const text = container.textContent ?? "";
    // Tolerant: whitespace / element boundaries between numbers and words.
    expect(text).toMatch(/18\s*of\s*30\s*imported/i);
    expect(text).toMatch(/12\s*failed/i);
  });

  it("surfaces skipped as informational, separate from failed, when skipped_count > 0", () => {
    const job = makeJob({
      id: "partial-skipped",
      progress_total: 30,
      synced_ids: ids("s", 13),
      failed_ids: ids("f", 12),
      skipped_count: 5,
    });

    const { container } = render(
      <SyncJobBanner job={job} onDismiss={vi.fn()} />,
    );

    const text = container.textContent ?? "";
    // Skipped surfaced and NOT folded into failed.
    expect(text).toMatch(/skipped/i);
    expect(text).toMatch(/5/);
    expect(text).toMatch(/12\s*failed/i);
    // Failed count stays genuine — 5 skipped are not counted as 17 failed.
    expect(text).not.toMatch(/17\s*failed/i);
  });

  it("omits the skipped clause when skipped_count is 0", () => {
    const job = makeJob({
      id: "partial-zero-skip",
      progress_total: 30,
      synced_ids: ids("s", 18),
      failed_ids: ids("f", 12),
      skipped_count: 0,
    });

    const { container } = render(
      <SyncJobBanner job={job} onDismiss={vi.fn()} />,
    );

    expect(container.textContent ?? "").not.toMatch(/skipped/i);
  });

  it("omits the skipped clause when skipped_count is null/undefined", () => {
    const job = makeJob({
      id: "partial-null-skip",
      progress_total: 30,
      synced_ids: ids("s", 18),
      failed_ids: ids("f", 12),
      skipped_count: null,
    });

    const { container } = render(
      <SyncJobBanner job={job} onDismiss={vi.fn()} />,
    );

    expect(container.textContent ?? "").not.toMatch(/skipped/i);
  });

  it("has NO setTimeout anywhere in the banner source (persistence is load-bearing)", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/import/SyncJobBanner.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/setTimeout/);
  });
});

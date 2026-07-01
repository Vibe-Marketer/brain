import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * FAIL-02 RED — SyncJobBanner "Retry failed (N)" action.
 *
 * Phase 29 Plan 01 made the partial-success breakdown visible + sticky. Plan 02
 * (FAIL-02) adds the ACTION: a "Retry failed (N)" affordance that re-attempts
 * ONLY the job's failed_ids set — never the already-synced or skipped ids —
 * dispatched by the parent through the EXISTING single-call retry path.
 *
 * The banner stays presentational: it exposes an optional `onRetry` prop
 * (signature: (sourceApp, failedIds) => void), mirroring the existing `onDismiss`
 * prop pattern. The mutation itself lives in the parent (<ImportSurface>).
 *
 * These assertions FAIL against the current banner, which has no retry
 * affordance. RED is the correct state for Task 1.
 *
 * Counts derive from `.length` on the TEXT[] failed_ids array only — never
 * parseInt/Number (dual-ID rule, src/CLAUDE.md). failed_ids are opaque strings
 * passed verbatim.
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

describe("SyncJobBanner FAIL-02 retry action", () => {
  it("renders a 'Retry failed (12)' affordance where N equals failed_ids.length", () => {
    const failedIds = ids("f", 12);
    const job = makeJob({
      id: "partial-retry",
      progress_total: 30,
      synced_ids: ids("s", 18),
      failed_ids: failedIds,
      skipped_count: 5,
      source_app: "fathom",
    });

    render(<SyncJobBanner job={job} onDismiss={vi.fn()} onRetry={vi.fn()} />);

    const retry = screen.getByRole("button", { name: /retry failed/i });
    expect(retry).toBeTruthy();
    // The count N in the label equals failed_ids.length (12), not requested/synced/skipped.
    expect(retry.textContent ?? "").toMatch(/12/);
    expect(retry.textContent ?? "").not.toMatch(/30/);
    expect(retry.textContent ?? "").not.toMatch(/18/);
  });

  it("calls onRetry exactly once with (source_app, the EXACT failed_ids array) — not synced/skipped", () => {
    const failedIds = ids("f", 12);
    const onRetry = vi.fn();
    const job = makeJob({
      id: "partial-retry-click",
      progress_total: 30,
      synced_ids: ids("s", 18),
      failed_ids: failedIds,
      skipped_count: 5,
      source_app: "fathom",
    });

    render(<SyncJobBanner job={job} onDismiss={vi.fn()} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: /retry failed/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith("fathom", failedIds);
    // Assert the array passed is the failed_ids only: exactly 12, exactly those ids.
    const [, passedIds] = onRetry.mock.calls[0];
    expect(passedIds).toHaveLength(12);
    expect(passedIds).toEqual(failedIds);
  });

  it("also renders retry on the failed branch when failed_ids is non-empty", () => {
    const failedIds = ids("f", 3);
    const onRetry = vi.fn();
    const job = makeJob({
      id: "failed-with-ids",
      status: "failed",
      error: "Provider rejected the request",
      failed_ids: failedIds,
      source_app: "fathom",
    });

    render(<SyncJobBanner job={job} onDismiss={vi.fn()} onRetry={onRetry} />);

    const retry = screen.getByRole("button", { name: /retry failed/i });
    expect(retry.textContent ?? "").toMatch(/3/);
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledWith("fathom", failedIds);
  });

  it("does not render a retry affordance when failed_ids is empty", () => {
    const job = makeJob({
      id: "no-failed",
      status: "completed_with_errors",
      progress_total: 18,
      synced_ids: ids("s", 18),
      failed_ids: [],
      skipped_count: 0,
      source_app: "fathom",
    });

    render(<SyncJobBanner job={job} onDismiss={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /retry failed/i })).toBeNull();
  });

  it("does not render a retry affordance when failed_ids is null", () => {
    const job = makeJob({
      id: "null-failed",
      status: "completed_with_errors",
      progress_total: 18,
      synced_ids: ids("s", 18),
      failed_ids: null,
      skipped_count: 0,
      source_app: "fathom",
    });

    render(<SyncJobBanner job={job} onDismiss={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /retry failed/i })).toBeNull();
  });

  it("renders without crashing and shows no retry button when onRetry is not provided", () => {
    const job = makeJob({
      id: "no-onretry",
      progress_total: 30,
      synced_ids: ids("s", 18),
      failed_ids: ids("f", 12),
      skipped_count: 5,
      source_app: "fathom",
    });

    const { container } = render(
      <SyncJobBanner job={job} onDismiss={vi.fn()} />,
    );

    // Still renders the breakdown, but no retry affordance.
    expect(container.textContent ?? "").toMatch(/18\s*of\s*30\s*imported/i);
    expect(screen.queryByRole("button", { name: /retry failed/i })).toBeNull();
  });

  it("disables the retry affordance for a provider that cannot retry (e.g. file-upload)", () => {
    const failedIds = ids("f", 4);
    const onRetry = vi.fn();
    const job = makeJob({
      id: "no-retry-provider",
      status: "completed_with_errors",
      progress_total: 10,
      synced_ids: ids("s", 6),
      failed_ids: failedIds,
      skipped_count: 0,
      // file-upload has no connector sync function -> canRetryFailedImport === false
      source_app: "file-upload",
    });

    render(<SyncJobBanner job={job} onDismiss={vi.fn()} onRetry={onRetry} />);

    const retry = screen.getByRole("button", { name: /retry failed/i });
    expect((retry as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(retry);
    expect(onRetry).not.toHaveBeenCalled();
  });
});

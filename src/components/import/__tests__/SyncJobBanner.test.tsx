import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

/**
 * Wave 0 RED — SyncJobBanner contract (JOB-03).
 *
 * Imports the not-yet-existing `<SyncJobBanner>` from
 * `@/components/import/SyncJobBanner`, so it fails at module resolution today.
 * RED is the correct, expected state for this Wave 0 task.
 *
 * The JOB-03 regression class under test: failures / completed_with_errors must
 * be STICKY — there is NO 8s/auto setTimeout that can drop them. We prove this
 * with vi.useFakeTimers + advancing 9000ms and asserting the banner persists.
 */

import { SyncJobBanner } from "../SyncJobBanner";
import type { SyncJob } from "@/hooks/useSyncJobs";

function makeJob(overrides: Partial<SyncJob>): SyncJob {
  return {
    id: "job-1",
    user_id: "user-1",
    status: "processing",
    created_at: "2026-06-23T00:00:00Z",
    updated_at: "2026-06-23T00:00:00Z",
    completed_at: null,
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

afterEach(() => {
  vi.useRealTimers();
});

describe("SyncJobBanner (JOB-03)", () => {
  it("renders a failure banner and keeps it after advancing timers 9000ms (sticky failures)", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const job = makeJob({
      id: "fail-1",
      status: "failed",
      error: "Provider rejected the request",
      completed_at: "2026-06-23T00:01:00Z",
    });

    render(<SyncJobBanner job={job} onDismiss={onDismiss} />);

    // Failure surfaced.
    expect(screen.getByText(/Provider rejected the request/i)).toBeTruthy();

    // Advance well past any 8s auto-dismiss — a failure must NOT vanish.
    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByText(/Provider rejected the request/i)).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("renders 'X synced, Y failed' for completed_with_errors and stays sticky after 9000ms", () => {
    vi.useFakeTimers();
    const job = makeJob({
      id: "partial-1",
      status: "completed_with_errors",
      synced_ids: ["a", "b", "c"],
      failed_ids: ["x", "y"],
      completed_at: "2026-06-23T00:01:00Z",
    });

    render(<SyncJobBanner job={job} onDismiss={vi.fn()} />);

    // 3 synced, 2 failed — counts come from string[] .length, never coercion.
    expect(screen.getByText(/3/).textContent).toBeTruthy();
    expect(screen.getByText(/synced/i)).toBeTruthy();
    expect(screen.getByText(/failed/i)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    // Still present — partial success is sticky too.
    expect(screen.getByText(/synced/i)).toBeTruthy();
    expect(screen.getByText(/failed/i)).toBeTruthy();
  });

  it("invokes onDismiss(jobId) when the dismiss control is clicked", () => {
    const onDismiss = vi.fn();
    const job = makeJob({
      id: "fail-dismiss",
      status: "failed",
      error: "boom",
      completed_at: "2026-06-23T00:01:00Z",
    });

    render(<SyncJobBanner job={job} onDismiss={onDismiss} />);

    const dismiss = screen.getByRole("button", { name: /dismiss/i });
    fireEvent.click(dismiss);

    expect(onDismiss).toHaveBeenCalledWith("fail-dismiss");
  });

  it("renders progress current/total for a processing job", () => {
    const job = makeJob({
      id: "proc-1",
      status: "processing",
      progress_current: 4,
      progress_total: 10,
    });

    render(<SyncJobBanner job={job} onDismiss={vi.fn()} />);

    expect(screen.getByText(/4/).textContent).toBeTruthy();
    expect(screen.getByText(/10/).textContent).toBeTruthy();
  });

  it("regression guard: never renders the literal text 'Auto-dismissing'", () => {
    const job = makeJob({
      id: "clean-1",
      status: "completed",
      synced_ids: ["a", "b"],
      completed_at: "2026-06-23T00:01:00Z",
    });

    const { container } = render(
      <SyncJobBanner job={job} onDismiss={vi.fn()} />,
    );

    expect(container.textContent).not.toMatch(/Auto-dismissing/i);
  });
});

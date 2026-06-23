import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Wave 0 RED — PerProviderSyncChip contract (JOB-05).
 *
 * Imports the not-yet-existing `<PerProviderSyncChip>` from
 * `@/components/import/PerProviderSyncChip`, so it fails at module resolution
 * today. RED is the correct, expected state for this Wave 0 task.
 *
 * Contract: "Last synced X · N new · M failed", per-provider (sourceApp prop,
 * NEVER a hardcoded "fathom"). N new and M failed are caller-supplied numbers
 * (computed in ImportSurface from results.length - importedIds.size and
 * lastCompletedJob.failed_ids.length) — the chip issues no query of its own.
 */

import { PerProviderSyncChip } from "../PerProviderSyncChip";

describe("PerProviderSyncChip (JOB-05)", () => {
  it("renders 'Last synced', N new, and M failed when all present", () => {
    render(
      <PerProviderSyncChip
        sourceApp="zoom"
        lastSyncedAt="2026-06-23T00:00:00Z"
        newCount={3}
        failedCount={2}
      />,
    );

    expect(screen.getByText(/last synced/i)).toBeTruthy();
    expect(screen.getByText(/3/).textContent).toBeTruthy();
    expect(screen.getByText(/new/i)).toBeTruthy();
    expect(screen.getByText(/2/).textContent).toBeTruthy();
    expect(screen.getByText(/failed/i)).toBeTruthy();
  });

  it("hides the failed segment when failedCount is 0", () => {
    const { container } = render(
      <PerProviderSyncChip
        sourceApp="zoom"
        lastSyncedAt="2026-06-23T00:00:00Z"
        newCount={1}
        failedCount={0}
      />,
    );

    expect(container.textContent).not.toMatch(/failed/i);
  });

  it("renders an up-to-date / 0-new state without crashing when newCount is 0", () => {
    const { container } = render(
      <PerProviderSyncChip
        sourceApp="zoom"
        lastSyncedAt="2026-06-23T00:00:00Z"
        newCount={0}
        failedCount={0}
      />,
    );

    expect(container.textContent).toBeTruthy();
  });

  it("regression guard: source contains no literal 'fathom' (provider comes from props)", () => {
    const { container } = render(
      <PerProviderSyncChip
        sourceApp="zoom"
        lastSyncedAt={null}
        newCount={0}
        failedCount={0}
      />,
    );

    expect(container.textContent?.toLowerCase()).not.toContain("fathom");
  });
});

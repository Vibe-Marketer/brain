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

});

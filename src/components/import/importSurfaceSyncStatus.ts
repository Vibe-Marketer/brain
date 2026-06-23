import {
  getSyncStatusForExternalIds,
  type SyncStatus,
} from "@/services/sync-status.service";

/**
 * importSurfaceSyncStatus — the provider-agnostic "already imported?" overlay
 * for `<ImportSurface>` (TBL-02).
 *
 * This helper replaces TWO defective behaviours at once:
 *
 *  1. The per-adapter `wasAlreadySynced(m) => m.synced` reliance (inconsistent
 *     across the 7 providers — TBL-02). Synced status is now read from ONE
 *     canonical client overlay: `getSyncStatusForExternalIds`.
 *  2. The Phase 24 carry-forward triple
 *     (.planning/phases/24-sync-status-foundation/deferred-items.md):
 *
 *     - CR-02 (real source_app, never literal "fathom"): rows are GROUPED by
 *       their own real `source_app`, and the reader is called ONCE PER PROVIDER
 *       group with that group's real source_app. A Zoom row is checked against
 *       `source_app = "zoom"`, never `"fathom"` — so non-Fathom providers stop
 *       reading unsynced forever.
 *
 *     - WR-02 (org threading): `organizationId` is threaded into every reader
 *       call so a user in multiple orgs cannot read another org's synced status.
 *
 *     - WR-01 (merge, never clobber): a row is flipped to `alreadyImported=true`
 *       ONLY when its own externalId is present in its OWN provider's status Map
 *       AND `hasWorkspaceEntries` is true. A row not present in any returned Map
 *       keeps its prior/unsynced state — one provider's batch NEVER resets
 *       another provider's rows.
 *
 * External ids are forwarded to the reader as opaque STRINGS — never numerically
 * coerced (dual recording-ID rule; `source_call_id` is TEXT end to end).
 *
 * Fail-open: empty input / unauthenticated caller marks nothing imported and
 * never throws (the reader already degrades to an empty Map).
 */

/** The minimal per-row shape the overlay needs: an opaque external id + its real provider. */
export interface SyncOverlayRow {
  /** Source-specific identifier (opaque TEXT — never coerced). */
  externalId: string;
  /** The row's REAL provider (CR-02). Read from `source_app`/`source_platform`. */
  sourceApp: string;
}

export interface OverlaySyncStatusOptions {
  /** Org scope threaded to the reader so synced status cannot leak cross-org (WR-02). */
  organizationId?: string | null;
}

/**
 * Resolve which of the given rows are already imported (synced + still in a
 * workspace), grouped by each row's real provider and merged — never clobbered.
 *
 * @returns a `Set<string>` of externalIds that are already imported. Callers map
 *   this onto their rows (`alreadyImported = importedIds.has(row.externalId)`),
 *   so rows NOT in the set keep their prior state (WR-01 merge semantics).
 */
export async function overlaySyncStatus(
  rows: SyncOverlayRow[],
  options: OverlaySyncStatusOptions = {},
): Promise<Set<string>> {
  const importedIds = new Set<string>();
  if (rows.length === 0) return importedIds;

  // Group rows by their REAL source_app (CR-02). Each provider gets its own
  // reader call with its own ids — a Zoom batch never touches a Grain row.
  const idsByProvider = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.externalId || !row.sourceApp) continue;
    const group = idsByProvider.get(row.sourceApp) ?? new Set<string>();
    group.add(row.externalId); // STRING — never coerced
    idsByProvider.set(row.sourceApp, group);
  }

  // One reader call per provider group, threading organizationId (WR-02).
  // Run the per-provider calls in parallel; merge their hits (WR-01).
  await Promise.all(
    Array.from(idsByProvider.entries()).map(async ([sourceApp, idSet]) => {
      const externalIds = Array.from(idSet);
      const statusMap: Map<string, SyncStatus> =
        await getSyncStatusForExternalIds(sourceApp, externalIds, {
          organizationId: options.organizationId ?? null,
        });

      // MERGE: flip to imported ONLY on a hit with workspace entries. Rows not
      // present in THIS provider's Map are left untouched — never reset (WR-01).
      for (const externalId of externalIds) {
        const status = statusMap.get(externalId);
        if (status?.hasWorkspaceEntries) {
          importedIds.add(externalId);
        }
      }
    }),
  );

  return importedIds;
}

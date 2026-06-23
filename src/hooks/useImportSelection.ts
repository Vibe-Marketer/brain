import { useCallback, useEffect, useMemo } from "react";

import {
  useImportSelectionStore,
  getSelectionScopeKey,
  getSelectionEntryKey,
  type SelectionFilter,
} from "@/stores/importSelectionStore";
import { getSyncStatusForExternalIds } from "@/services/sync-status.service";
import type { ConnectorSourceApp } from "@/components/connectors/registry/types";

/**
 * useImportSelection — the UI-shape-independent reconciliation hook over the
 * durable selection store (Plan 01) wired to canonical server truth (Phase 24).
 *
 * This is the React surface Phase 26's `<ImportSurface>` consumes for BOTH the
 * Import tab and the Sync tab. Inputs are a provider `sourceApp` + date bounds +
 * raw `externalId` strings — no Meeting/AvailableCall/table-row coupling.
 *
 * It re-exposes the store's actions scoped to one `scopeKey` (provider + date
 * range) and — critically — exposes `reconcile(externalIds)` which drops from
 * the explicit selection any id that has BECOME synced (the second half of
 * SEL-01). Reconcile reads "synced" ONLY from `recordings` via the Phase 24
 * reader; the persisted store is never the authority for "synced" (threat
 * T-25-05). It threads `organizationId` so reconciliation cannot read another
 * org's recordings (threat T-25-04).
 */

export interface UseImportSelectionParams {
  sourceApp: ConnectorSourceApp;
  dateStart: string | null;
  dateEnd: string | null;
  /** Org scope threaded to the Phase 24 reader so reconcile cannot read cross-org. */
  organizationId?: string | null;
}

export interface UseImportSelectionResult {
  /** The scope key (provider + date range) this selection is bound to. */
  scopeKey: string;
  /** Toggle a single row's explicit selection by raw provider externalId. */
  toggle: (externalId: string) => void;
  /** SEL-02: select every call matching the current filter (descriptor, not ids). */
  selectAllMatching: (filter: SelectionFilter) => void;
  /** Drop the SEL-02 all-matching descriptor for this scope. */
  clearAllMatching: () => void;
  /**
   * Wipe the whole selection for this scope. CALL ON JOB CREATION ONLY — this is
   * the single clear path; it is NOT a refetch-clear (Anti-Pattern 1).
   */
  clearSelection: () => void;
  /** True when the externalId is explicitly selected OR an all-matching descriptor is active. */
  isSelected: (externalId: string) => boolean;
  /** Explicit selection count, or the "all" sentinel when all-matching is active. */
  count: number | "all";
  /**
   * Reconcile the explicit selection against canonical server truth: drop any
   * currently-selected id that is now synced (present in the Phase 24 reader's
   * Map). Drops synced ids ONLY — it never clears the whole selection and never
   * touches the all-matching descriptor. Reconcile drops synced ids only; it is
   * NOT a refetch-clear (Anti-Pattern 1). Pass externalIds as STRINGS — they are
   * forwarded to the reader as-is, never coerced.
   */
  reconcile: (externalIds: string[]) => Promise<void>;
  /** Thin effect wrapper: reconcile whenever the given externalIds change. */
  useReconcileOnIds: (externalIds: string[]) => void;
}

export function useImportSelection(
  params: UseImportSelectionParams,
): UseImportSelectionResult {
  const { sourceApp, dateStart, dateEnd, organizationId } = params;

  const scopeKey = useMemo(
    () => getSelectionScopeKey(sourceApp, dateStart, dateEnd),
    [sourceApp, dateStart, dateEnd],
  );

  // Subscribe ONLY to this scope's slice — a stable reference the store owns
  // (do not build new objects inside the selector each render).
  const scope = useImportSelectionStore((s) => s.selectionsByScope[scopeKey]);

  // Store actions are stable identities; pull them once.
  const storeToggle = useImportSelectionStore((s) => s.toggle);
  const storeSelectAllMatching = useImportSelectionStore(
    (s) => s.selectAllMatching,
  );
  const storeClearAllMatching = useImportSelectionStore(
    (s) => s.clearAllMatching,
  );
  const storeClearScope = useImportSelectionStore((s) => s.clearScope);
  const storeDropSyncedIds = useImportSelectionStore((s) => s.dropSyncedIds);

  const toggle = useCallback(
    (externalId: string) =>
      storeToggle(scopeKey, getSelectionEntryKey(externalId)),
    [storeToggle, scopeKey],
  );

  const selectAllMatching = useCallback(
    (filter: SelectionFilter) => storeSelectAllMatching(scopeKey, filter),
    [storeSelectAllMatching, scopeKey],
  );

  const clearAllMatching = useCallback(
    () => storeClearAllMatching(scopeKey),
    [storeClearAllMatching, scopeKey],
  );

  /** CALL ON JOB CREATION ONLY — the single clear path, never on refetch. */
  const clearSelection = useCallback(
    () => storeClearScope(scopeKey),
    [storeClearScope, scopeKey],
  );

  const isSelected = useCallback(
    (externalId: string): boolean => {
      if (scope?.allMatching) return true;
      return (
        scope?.explicitIds.includes(getSelectionEntryKey(externalId)) ?? false
      );
    },
    [scope],
  );

  const count: number | "all" = scope?.allMatching
    ? "all"
    : (scope?.explicitIds.length ?? 0);

  /**
   * Reconcile drops synced ids only; it is NOT a refetch-clear (Anti-Pattern 1).
   * "Synced" is read ONLY from `recordings` via the Phase 24 reader — never from
   * the persisted store. externalIds are forwarded as STRINGS, never coerced.
   */
  const reconcile = useCallback(
    async (externalIds: string[]): Promise<void> => {
      if (externalIds.length === 0) return;

      const syncedMap = await getSyncStatusForExternalIds(
        sourceApp,
        externalIds,
        { organizationId },
      );
      if (syncedMap.size === 0) return; // background refetch — nothing to drop

      // Read the CURRENT explicit selection at call time (avoid stale closure).
      const currentScope =
        useImportSelectionStore.getState().selectionsByScope[scopeKey];
      const explicitIds = currentScope?.explicitIds ?? [];
      if (explicitIds.length === 0) return;

      // Subset of currently-selected ids that are now synced → drop only those.
      const syncedEntryKeys = externalIds
        .filter((externalId) => syncedMap.has(externalId))
        .map((externalId) => getSelectionEntryKey(externalId))
        .filter((entryKey) => explicitIds.includes(entryKey));

      if (syncedEntryKeys.length === 0) return;
      storeDropSyncedIds(scopeKey, syncedEntryKeys);
    },
    [sourceApp, organizationId, scopeKey, storeDropSyncedIds],
  );

  const useReconcileOnIds = (externalIds: string[]): void => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- stable surface; consumers call this as a hook
    useEffect(() => {
      void reconcile(externalIds);
      // Reconcile on identity change of the id list.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reconcile, externalIds.join("|")]);
  };

  return {
    scopeKey,
    toggle,
    selectAllMatching,
    clearAllMatching,
    clearSelection,
    isSelected,
    count,
    reconcile,
    useReconcileOnIds,
  };
}

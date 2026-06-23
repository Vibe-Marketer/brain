import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ConnectorSourceApp } from "@/components/connectors/registry/types";

/**
 * Import Selection Store — the durable, persisted client-side selection store
 * for the Import/Sync surface (CallVault v2.1, Phase 25, SEL-01 + SEL-02).
 *
 * ROOT-CAUSE FIX for "the selections were GONE." Selection used to live in
 * volatile React `useState` inside the (now-deleted) forked import wizard and
 * its sync-tab selection hook, so it was wiped on unmount, date-range change,
 * and the OAuth same-tab full-page redirect. Moving it into a Zustand store wrapped
 * in the `persist` middleware (backed by sessionStorage) makes those failures
 * impossible by construction: the SPA rehydrates from storage on boot.
 *
 * STORAGE BACKEND = sessionStorage (verified, SEL-01). The connector OAuth
 * return is a SAME-TAB FULL-PAGE REDIRECT (ConnectorSetupCluster.tsx:302 sets
 * `window.location.href`; ImportPage.tsx reads the return from
 * `window.location.search` on MOUNT — i.e. the app boots fresh). sessionStorage
 * survives that same-tab redirect AND in-app navigation/unmount, and clears
 * when the tab closes so stale selections do not linger across days. This
 * satisfies all four SEL-01 survival cases. NOT the tab-spanning persistent
 * browser store (which would let selections linger across days).
 *
 * SELECT-ALL-MATCHING = filter descriptor, NOT enumerated ids (SEL-02). The
 * provider search is cursor-paginated and unbounded; you cannot enumerate all
 * matching ids without paging the entire provider (that is Phase 28's
 * server-side job). So "select all matching the current filter" is stored as a
 * descriptor `{ mode: "all-matching", filter }`, never a materialized id array.
 */

/** sessionStorage key under which the persisted selection blob lives. */
export const IMPORT_SELECTION_STORAGE_KEY = "callvault-import-selection";

/**
 * The active provider search filter captured by a select-all-matching
 * descriptor. Open record so any provider's filter fields can be carried
 * forward to Phase 28's server-side pager without a schema change here.
 */
export interface SelectionFilter {
  search?: string;
  dateStart: string | null;
  dateEnd: string | null;
  [k: string]: unknown;
}

/**
 * SEL-02 representation: "all calls matching the current filter" as a
 * descriptor, NOT an enumerated id list. The matching set is resolved
 * server-side in Phase 28 — never materialized here.
 */
export interface AllMatchingDescriptor {
  mode: "all-matching";
  filter: SelectionFilter;
}

/** Per-scope selection: explicit per-row ids plus an optional all-matching descriptor. */
export interface ScopeSelection {
  /** Explicit per-checkbox selection. Array (not Set) so persist JSON-serializes cleanly. */
  explicitIds: string[];
  /** SEL-02 descriptor for "select all matching", or null when not active. */
  allMatching: AllMatchingDescriptor | null;
}

export interface ImportSelectionState {
  /** Selection state keyed by scope (`source_app` + date range). */
  selectionsByScope: Record<string, ScopeSelection>;

  // Actions (toggle/select/clear selection verbs, scope-aware)
  toggle: (scopeKey: string, entryKey: string) => void;
  setExplicit: (scopeKey: string, entryKeys: string[]) => void;
  clearExplicit: (scopeKey: string) => void;
  selectAllMatching: (scopeKey: string, filter: SelectionFilter) => void;
  clearAllMatching: (scopeKey: string) => void;
  isSelected: (scopeKey: string, entryKey: string) => boolean;
  getSelectionCount: (scopeKey: string) => number | "all";
  clearScope: (scopeKey: string) => void;
  dropSyncedIds: (scopeKey: string, syncedEntryKeys: string[]) => void;
}

const EMPTY_SCOPE: ScopeSelection = { explicitIds: [], allMatching: null };

/**
 * Pure helper: build the scope key from provider + date range.
 *
 * `${encodeURIComponent(sourceApp)}::${dateStart ?? "*"}::${dateEnd ?? "*"}`
 *
 * Mirrors the existing `::` + encodeURIComponent selection-key convention
 * (src/components/transcripts/syncSelection.ts). Changing the date range
 * produces a DIFFERENT scope key, so the prior range's selection is preserved
 * untouched — this realizes the locked "keyed by provider + date range"
 * decision and the date-range-preservation benchmark.
 *
 * `dateStart`/`dateEnd` are ISO date strings (or null for an open bound).
 */
export function getSelectionScopeKey(
  sourceApp: ConnectorSourceApp,
  dateStart: string | null,
  dateEnd: string | null,
): string {
  return `${encodeURIComponent(sourceApp)}::${dateStart ?? "*"}::${dateEnd ?? "*"}`;
}

/**
 * Pure helper: build the selection-entry key from a provider `source_call_id`.
 *
 * `externalId` is the provider `source_call_id` (TEXT — UUID or BIGINT-string).
 * NEVER apply numeric coercion to it (Standing Constraint: dual recording-ID
 * rule — it is treated as opaque text end to end).
 */
export function getSelectionEntryKey(externalId: string): string {
  return encodeURIComponent(externalId);
}

function getScope(
  state: ImportSelectionState,
  scopeKey: string,
): ScopeSelection {
  return state.selectionsByScope[scopeKey] ?? EMPTY_SCOPE;
}

export const useImportSelectionStore = create<ImportSelectionState>()(
  persist(
    (set, get) => ({
      selectionsByScope: {},

      toggle: (scopeKey, entryKey) =>
        set((state) => {
          const scope = getScope(state, scopeKey);
          const has = scope.explicitIds.includes(entryKey);
          const explicitIds = has
            ? scope.explicitIds.filter((id) => id !== entryKey)
            : [...scope.explicitIds, entryKey];
          return {
            selectionsByScope: {
              ...state.selectionsByScope,
              [scopeKey]: { ...scope, explicitIds },
            },
          };
        }),

      setExplicit: (scopeKey, entryKeys) =>
        set((state) => {
          const scope = getScope(state, scopeKey);
          return {
            selectionsByScope: {
              ...state.selectionsByScope,
              [scopeKey]: { ...scope, explicitIds: [...entryKeys] },
            },
          };
        }),

      clearExplicit: (scopeKey) =>
        set((state) => {
          const scope = getScope(state, scopeKey);
          return {
            selectionsByScope: {
              ...state.selectionsByScope,
              [scopeKey]: { ...scope, explicitIds: [] },
            },
          };
        }),

      selectAllMatching: (scopeKey, filter) =>
        set((state) => {
          const scope = getScope(state, scopeKey);
          return {
            selectionsByScope: {
              ...state.selectionsByScope,
              [scopeKey]: {
                ...scope,
                allMatching: { mode: "all-matching", filter },
              },
            },
          };
        }),

      clearAllMatching: (scopeKey) =>
        set((state) => {
          const scope = getScope(state, scopeKey);
          return {
            selectionsByScope: {
              ...state.selectionsByScope,
              [scopeKey]: { ...scope, allMatching: null },
            },
          };
        }),

      isSelected: (scopeKey, entryKey) => {
        const scope = getScope(get(), scopeKey);
        if (scope.allMatching) return true;
        return scope.explicitIds.includes(entryKey);
      },

      getSelectionCount: (scopeKey) => {
        const scope = getScope(get(), scopeKey);
        // "all" sentinel: count is provider-bounded, resolved server-side in Phase 28.
        if (scope.allMatching) return "all";
        return scope.explicitIds.length;
      },

      /**
       * Wipe explicitIds + allMatching for one scope.
       *
       * Called ONLY on job creation, never on background refetch/poll
       * (Anti-Pattern 1). This is the single clear path triggered by import
       * firing — callers invoke it when a job is created.
       */
      clearScope: (scopeKey) =>
        set((state) => {
          const next = { ...state.selectionsByScope };
          delete next[scopeKey];
          return { selectionsByScope: next };
        }),

      /**
       * Reconcile primitive (Plan 02's hook calls this): remove the given
       * synced keys from explicitIds. Leaves the all-matching descriptor and
       * all other ids untouched.
       */
      dropSyncedIds: (scopeKey, syncedEntryKeys) =>
        set((state) => {
          const scope = state.selectionsByScope[scopeKey];
          if (!scope) return {};
          const toDrop = new Set(syncedEntryKeys);
          return {
            selectionsByScope: {
              ...state.selectionsByScope,
              [scopeKey]: {
                ...scope,
                explicitIds: scope.explicitIds.filter((id) => !toDrop.has(id)),
              },
            },
          };
        }),
    }),
    {
      name: IMPORT_SELECTION_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

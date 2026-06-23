import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import {
  useImportSelectionStore,
  getSelectionScopeKey,
  getSelectionEntryKey,
  IMPORT_SELECTION_STORAGE_KEY,
  type SelectionFilter,
} from "../importSelectionStore";

/**
 * Proves the 3 John-bug benchmarks (rehydration durability, date-range
 * preservation, provider isolation) plus the SEL-02 select-all descriptor,
 * clear-on-job semantics, and the dropSyncedIds reconcile primitive — all
 * against the REAL jsdom sessionStorage (no mocks).
 */

function resetStore() {
  act(() => {
    useImportSelectionStore.setState({ selectionsByScope: {} });
  });
}

describe("importSelectionStore", () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetStore();
  });

  describe("durability / rehydration (OAuth + navigation benchmark)", () => {
    it("survives a simulated fresh boot by rehydrating from sessionStorage", () => {
      const scope = getSelectionScopeKey("fathom", "2026-01-01", "2026-01-31");
      const a = getSelectionEntryKey("143800259");
      const b = getSelectionEntryKey("143800260");

      act(() => {
        const { toggle } = useImportSelectionStore.getState();
        toggle(scope, a);
        toggle(scope, b);
      });

      // The persisted JSON in REAL sessionStorage must hold both keys.
      const raw = sessionStorage.getItem(IMPORT_SELECTION_STORAGE_KEY);
      expect(raw).toBeTruthy();
      expect(raw).toContain(a);
      expect(raw).toContain(b);

      // Simulate a fresh app boot: wipe in-memory state, then rehydrate.
      resetStore();
      expect(
        useImportSelectionStore.getState().selectionsByScope[scope],
      ).toBeUndefined();

      act(() => {
        useImportSelectionStore.persist.rehydrate();
      });

      const state = useImportSelectionStore.getState();
      expect(state.isSelected(scope, a)).toBe(true);
      expect(state.isSelected(scope, b)).toBe(true);
    });
  });

  describe("date-range preservation", () => {
    it("preserves range A's selection when range B is selected", () => {
      const scopeA = getSelectionScopeKey("fathom", "2026-01-01", "2026-01-31");
      const scopeB = getSelectionScopeKey("fathom", "2026-02-01", "2026-02-28");
      const a1 = getSelectionEntryKey("a-1");
      const b1 = getSelectionEntryKey("b-1");

      act(() => {
        const { toggle } = useImportSelectionStore.getState();
        toggle(scopeA, a1);
        toggle(scopeB, b1);
      });

      const state = useImportSelectionStore.getState();
      expect(scopeA).not.toBe(scopeB);
      expect(state.isSelected(scopeA, a1)).toBe(true);
      expect(state.isSelected(scopeA, b1)).toBe(false);
      expect(state.isSelected(scopeB, b1)).toBe(true);
      expect(state.isSelected(scopeB, a1)).toBe(false);
    });
  });

  describe("provider isolation", () => {
    it("does not leak zoom selection into fathom for the same date range", () => {
      const zoom = getSelectionScopeKey("zoom", "2026-01-01", "2026-01-31");
      const fathom = getSelectionScopeKey("fathom", "2026-01-01", "2026-01-31");
      const id = getSelectionEntryKey("shared-id-123");

      act(() => {
        useImportSelectionStore.getState().toggle(zoom, id);
      });

      const state = useImportSelectionStore.getState();
      expect(state.isSelected(zoom, id)).toBe(true);
      expect(state.isSelected(fathom, id)).toBe(false);
    });
  });

  describe("SEL-02 select-all-matching descriptor", () => {
    it("stores a descriptor (not an enumerated id array) and counts as 'all'", () => {
      const scope = getSelectionScopeKey("fathom", "2026-01-01", "2026-01-31");
      const filter: SelectionFilter = {
        search: "quarterly review",
        dateStart: "2026-01-01",
        dateEnd: "2026-01-31",
      };

      act(() => {
        useImportSelectionStore.getState().selectAllMatching(scope, filter);
      });

      const state = useImportSelectionStore.getState();
      // isSelected returns true for ARBITRARY ids under an all-matching scope.
      expect(state.isSelected(scope, getSelectionEntryKey("never-enumerated"))).toBe(
        true,
      );
      expect(state.getSelectionCount(scope)).toBe("all");

      const scoped = state.selectionsByScope[scope];
      expect(scoped.allMatching?.mode).toBe("all-matching");
      expect(scoped.allMatching?.filter.search).toBe("quarterly review");
      // The persisted JSON must NOT enumerate the matching ids.
      const raw = sessionStorage.getItem(IMPORT_SELECTION_STORAGE_KEY) ?? "";
      expect(raw).toContain("all-matching");
      expect(raw).not.toContain("never-enumerated");
      expect(scoped.explicitIds).toEqual([]);
    });
  });

  describe("clear-on-job semantics", () => {
    it("clearScope empties one scope and leaves others intact", () => {
      const scopeA = getSelectionScopeKey("fathom", "2026-01-01", "2026-01-31");
      const scopeB = getSelectionScopeKey("fathom", "2026-02-01", "2026-02-28");
      const a1 = getSelectionEntryKey("a-1");
      const b1 = getSelectionEntryKey("b-1");

      act(() => {
        const { toggle, selectAllMatching } = useImportSelectionStore.getState();
        toggle(scopeA, a1);
        selectAllMatching(scopeA, { dateStart: null, dateEnd: null });
        toggle(scopeB, b1);
      });

      act(() => {
        useImportSelectionStore.getState().clearScope(scopeA);
      });

      const state = useImportSelectionStore.getState();
      expect(state.isSelected(scopeA, a1)).toBe(false);
      expect(state.getSelectionCount(scopeA)).toBe(0);
      expect(state.selectionsByScope[scopeA]?.allMatching ?? null).toBeNull();
      // Other scope untouched (no clear-on-refetch path exists).
      expect(state.isSelected(scopeB, b1)).toBe(true);
    });
  });

  describe("dropSyncedIds reconcile primitive", () => {
    it("removes only the given explicit keys, leaving descriptor + others intact", () => {
      const scope = getSelectionScopeKey("fathom", "2026-01-01", "2026-01-31");
      const keep = getSelectionEntryKey("keep-1");
      const synced = getSelectionEntryKey("synced-1");

      act(() => {
        const { toggle, selectAllMatching } = useImportSelectionStore.getState();
        toggle(scope, keep);
        toggle(scope, synced);
        selectAllMatching(scope, { dateStart: null, dateEnd: null });
      });

      act(() => {
        useImportSelectionStore.getState().dropSyncedIds(scope, [synced]);
      });

      const state = useImportSelectionStore.getState();
      const scoped = state.selectionsByScope[scope];
      expect(scoped.explicitIds).toContain(keep);
      expect(scoped.explicitIds).not.toContain(synced);
      // dropSyncedIds leaves the all-matching descriptor untouched.
      expect(scoped.allMatching?.mode).toBe("all-matching");
    });
  });
});

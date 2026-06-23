import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useImportSelection } from "../useImportSelection";
import {
  useImportSelectionStore,
  getSelectionScopeKey,
  getSelectionEntryKey,
} from "@/stores/importSelectionStore";
import * as syncStatusService from "@/services/sync-status.service";
import type { SyncStatus } from "@/services/sync-status.service";

/**
 * Proves the SEL-01 synced-auto-drop reconciliation and — critically — that a
 * background refetch (empty synced Map) drops NOTHING (Anti-Pattern 1 cannot
 * recur). Also proves the SEL-02 all-matching descriptor survives reconcile,
 * and that UUID + BIGINT-string ids reconcile without numeric coercion.
 *
 * The Phase 24 reader (getSyncStatusForExternalIds) is mocked — no DB contact.
 */

const SOURCE_APP = "fathom" as const;
const DATE_START = "2026-01-01";
const DATE_END = "2026-01-31";

function resetStore() {
  act(() => {
    useImportSelectionStore.setState({ selectionsByScope: {} });
  });
}

function mockReaderReturning(synced: Map<string, SyncStatus>) {
  const spy = vi.spyOn(syncStatusService, "getSyncStatusForExternalIds");
  spy.mockResolvedValue(synced);
  return spy;
}

function renderSelection() {
  return renderHook(() =>
    useImportSelection({
      sourceApp: SOURCE_APP,
      dateStart: DATE_START,
      dateEnd: DATE_END,
    }),
  );
}

describe("useImportSelection", () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetStore();
    vi.restoreAllMocks();
  });

  it("auto-drops a selected id once it has become synced (SEL-01), keeping the rest", async () => {
    // A BIGINT-string id (Fathom) plus two more.
    const idSynced = "143800259";
    const idA = "143800260";
    const idB = "143800261";

    const { result } = renderSelection();

    act(() => {
      result.current.toggle(idSynced);
      result.current.toggle(idA);
      result.current.toggle(idB);
    });

    expect(result.current.count).toBe(3);

    // The reader reports only idSynced is now in `recordings` (synced).
    mockReaderReturning(
      new Map<string, SyncStatus>([
        [idSynced, { recordingUuid: "rec-uuid-1", hasWorkspaceEntries: true }],
      ]),
    );

    await act(async () => {
      await result.current.reconcile([idSynced, idA, idB]);
    });

    expect(result.current.isSelected(idSynced)).toBe(false);
    expect(result.current.isSelected(idA)).toBe(true);
    expect(result.current.isSelected(idB)).toBe(true);
    expect(result.current.count).toBe(2);
  });

  it("does NOT clear the selection on a background refetch (empty synced Map)", async () => {
    const idA = "call-a";
    const idB = "call-b";

    const { result } = renderSelection();

    act(() => {
      result.current.toggle(idA);
      result.current.toggle(idB);
    });
    expect(result.current.count).toBe(2);

    // A plain background refetch: nothing is synced.
    const spy = mockReaderReturning(new Map());

    await act(async () => {
      await result.current.reconcile([idA, idB]);
    });

    // The whole selection persists — zero ids dropped (NOT a clear-on-fetch).
    expect(spy).toHaveBeenCalled();
    expect(result.current.isSelected(idA)).toBe(true);
    expect(result.current.isSelected(idB)).toBe(true);
    expect(result.current.count).toBe(2);
  });

  it("preserves the all-matching descriptor (SEL-02) through reconcile", async () => {
    const { result } = renderSelection();
    const scopeKey = getSelectionScopeKey(SOURCE_APP, DATE_START, DATE_END);

    act(() => {
      result.current.selectAllMatching({
        search: "quarterly",
        dateStart: DATE_START,
        dateEnd: DATE_END,
      });
    });
    expect(result.current.count).toBe("all");

    // Even if the reader reports something synced, reconcile must not touch
    // the all-matching descriptor.
    mockReaderReturning(
      new Map<string, SyncStatus>([
        ["whatever", { recordingUuid: "rec-x", hasWorkspaceEntries: false }],
      ]),
    );

    await act(async () => {
      await result.current.reconcile(["whatever"]);
    });

    const scoped = useImportSelectionStore.getState().selectionsByScope[scopeKey];
    expect(scoped?.allMatching?.mode).toBe("all-matching");
    expect(result.current.count).toBe("all");
  });

  it("reconciles UUID and BIGINT-string ids without numeric coercion", async () => {
    // A Zoom-style UUID id and a Fathom BIGINT-string id.
    const uuidId = "550e8400-e29b-41d4-a716-446655440000";
    const bigintId = "143800999";

    const { result } = renderSelection();

    act(() => {
      result.current.toggle(uuidId);
      result.current.toggle(bigintId);
    });
    expect(result.current.count).toBe(2);

    const spy = mockReaderReturning(
      new Map<string, SyncStatus>([
        [uuidId, { recordingUuid: "rec-uuid", hasWorkspaceEntries: true }],
        [bigintId, { recordingUuid: "rec-bigint", hasWorkspaceEntries: true }],
      ]),
    );

    await act(async () => {
      await result.current.reconcile([uuidId, bigintId]);
    });

    // The reader was called with the ids as STRINGS, exactly as-is.
    expect(spy).toHaveBeenCalledWith(
      SOURCE_APP,
      [uuidId, bigintId],
      expect.anything(),
    );
    // Both synced ids dropped.
    expect(result.current.isSelected(uuidId)).toBe(false);
    expect(result.current.isSelected(bigintId)).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("only drops ids that are CURRENTLY selected, ignoring synced-but-unselected ids", async () => {
    const selected = "sel-1";
    const notSelected = "not-sel-1";

    const { result } = renderSelection();
    act(() => {
      result.current.toggle(selected);
    });

    // Reader reports BOTH ids synced, but only `selected` is in the selection.
    mockReaderReturning(
      new Map<string, SyncStatus>([
        [selected, { recordingUuid: "r1", hasWorkspaceEntries: true }],
        [notSelected, { recordingUuid: "r2", hasWorkspaceEntries: true }],
      ]),
    );

    await act(async () => {
      await result.current.reconcile([selected, notSelected]);
    });

    const scopeKey = getSelectionScopeKey(SOURCE_APP, DATE_START, DATE_END);
    const scoped = useImportSelectionStore.getState().selectionsByScope[scopeKey];
    expect(scoped?.explicitIds).not.toContain(getSelectionEntryKey(selected));
    expect(result.current.count).toBe(0);
  });
});

import { useCallback, useState } from "react";
import type { Meeting } from "@/hooks/useMeetingsSync";
import { getUnsyncedMeetingSelectionKey } from "@/components/transcripts/syncSelection";

/**
 * Owns both selection sets used by the Sync tab.
 *
 *   - `unsyncedSelected: Set<string>` keyed by `<platform>::<recording_id>`
 *     so the same recording id from two providers stays distinct.
 *   - `existingSelected: number[]` keyed by the legacy BIGINT recording_id
 *     (kept as `number[]` for prop-shape compatibility with
 *     `SyncedTranscriptsSection`).
 *
 * Returns toggle + select-all + clear callbacks for each set. No data
 * fetching — selection only.
 */

export interface UseSyncTabSelectionResult {
  unsyncedSelected: Set<string>;
  existingSelected: number[];
  toggleUnsynced: (selectionKey: string) => void;
  selectAllUnsynced: (visible: Meeting[]) => void;
  clearUnsynced: () => void;
  toggleExisting: (id: number) => void;
  selectAllExisting: (visible: Meeting[]) => void;
  clearExisting: () => void;
  setExistingSelected: (ids: number[]) => void;
}

export function useSyncTabSelection(): UseSyncTabSelectionResult {
  const [unsyncedSelected, setUnsyncedSelected] = useState<Set<string>>(
    new Set(),
  );
  const [existingSelected, setExistingSelected] = useState<number[]>([]);

  const toggleUnsynced = useCallback((selectionKey: string) => {
    setUnsyncedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(selectionKey)) {
        next.delete(selectionKey);
      } else {
        next.add(selectionKey);
      }
      return next;
    });
  }, []);

  const selectAllUnsynced = useCallback((visible: Meeting[]) => {
    setUnsyncedSelected((prev) => {
      if (prev.size === visible.length) return new Set();
      return new Set(visible.map(getUnsyncedMeetingSelectionKey));
    });
  }, []);

  const clearUnsynced = useCallback(() => setUnsyncedSelected(new Set()), []);

  const toggleExisting = useCallback((id: number) => {
    setExistingSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const selectAllExisting = useCallback((visible: Meeting[]) => {
    setExistingSelected((prev) => {
      if (prev.length === visible.length) return [];
      return visible.map((t) => Number(t.recording_id));
    });
  }, []);

  const clearExisting = useCallback(() => setExistingSelected([]), []);

  return {
    unsyncedSelected,
    existingSelected,
    toggleUnsynced,
    selectAllUnsynced,
    clearUnsynced,
    toggleExisting,
    selectAllExisting,
    clearExisting,
    setExistingSelected,
  };
}

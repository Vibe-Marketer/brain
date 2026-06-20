import { useCallback, useRef } from "react";
import type { Meeting } from "@/hooks/useMeetingsSync";
import { getSyncStatusForExternalIds } from "@/services/sync-status.service";

/**
 * Glue between `useSyncTabOrchestration` (owns the unsynced `meetings` list)
 * and `useSyncTabState` (polls `sync_jobs`, removes rows when they complete,
 * surfaces host/categories/active jobs).
 *
 * Both hooks need to call each other's setters but neither can be
 * instantiated before the other. The bridge owns two refs:
 *
 *   - `setMeetingsRef` → `orchestration.setMeetings`, installed via
 *     `bindSetMeetings(...)` immediately after orchestration runs.
 *   - `setActiveSyncJobsRef` → `useSyncTabState`'s `setActiveSyncJobs`,
 *     installed via `bindSetActiveSyncJobs(...)` immediately after it runs.
 *
 * Callers expose:
 *   - `checkSyncStatus(ids)` → flips `synced: true` on matching meetings
 *   - `bridgeSetMeetings(updater)` → forwards structural filter updates
 *     from `useSyncTabState` onto orchestration's Meeting[] state
 *   - `forwardSetActiveSyncJobs(updater)` → orchestration calls through
 *     to push newly-created sync_jobs rows into the active-jobs card
 */

type SetMeetings = React.Dispatch<React.SetStateAction<Meeting[]>>;
type SetActiveSyncJobs = (updater: unknown) => void;

export function useSyncTabStateBridge() {
  const setMeetingsRef = useRef<SetMeetings | null>(null);
  const setActiveSyncJobsRef = useRef<SetActiveSyncJobs | null>(null);

  const bindSetMeetings = useCallback((fn: SetMeetings) => {
    setMeetingsRef.current = fn;
  }, []);

  const bindSetActiveSyncJobs = useCallback(
    (fn: (updater: unknown) => void) => {
      setActiveSyncJobsRef.current = fn;
    },
    [],
  );

  const checkSyncStatus = useCallback(
    async (sourceApp: string, recordingIds: string[]) => {
      const statusMap = await getSyncStatusForExternalIds(
        sourceApp,
        recordingIds,
      );
      setMeetingsRef.current?.((prev) =>
        prev.map((m) => ({ ...m, synced: statusMap.has(m.recording_id) })),
      );
    },
    [],
  );

  const bridgeSetMeetings = useCallback(
    (
      next:
        | Array<{ recording_id: string }>
        | ((prev: Array<{ recording_id: string }>) => Array<{
            recording_id: string;
          }>),
    ) => {
      setMeetingsRef.current?.(
        typeof next === "function"
          ? (prev) =>
              next(prev as Array<{ recording_id: string }>) as Meeting[]
          : (next as Meeting[]),
      );
    },
    [],
  );

  const forwardSetActiveSyncJobs = useCallback(
    (updater: unknown) => setActiveSyncJobsRef.current?.(updater),
    [],
  );

  return {
    bindSetMeetings,
    bindSetActiveSyncJobs,
    checkSyncStatus,
    bridgeSetMeetings,
    forwardSetActiveSyncJobs,
  };
}

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-config";
import {
  fetchPublicRecording,
  normalizePublicRecordingId,
} from "@/services/public-recording.service";
import type { PublicRecordingPayload } from "@/types/public-recording";

export function usePublicRecording(recordingId: string | null | undefined) {
  const normalizedId = normalizePublicRecordingId(recordingId);

  return useQuery({
    queryKey: queryKeys.publicRecording.detail(normalizedId ?? "invalid"),
    queryFn: () => fetchPublicRecording(normalizedId!),
    enabled: normalizedId !== null,
    retry: false,
    select: (result): PublicRecordingPayload | null =>
      result.status === "available" ? result.recording : null,
  });
}

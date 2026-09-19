import { z } from "zod";

import type {
  PublicRecordingPayload,
  PublicRecordingResult,
} from "@/types/public-recording";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const publicRecordingSchema = z
  .object({
    recording_id: z.string().uuid(),
    call_name: z.string(),
    recording_start_time: z.string().nullable(),
    duration: z.number().nullable(),
    full_transcript: z.string().nullable(),
  })
  .strict();

export function normalizePublicRecordingId(
  recordingId: string | null | undefined,
): string | null {
  const candidate = recordingId?.trim();
  return candidate && UUID_PATTERN.test(candidate)
    ? candidate.toLowerCase()
    : null;
}

export async function fetchPublicRecording(
  recordingId: string,
): Promise<PublicRecordingResult> {
  const normalizedId = normalizePublicRecordingId(recordingId);

  if (!normalizedId) {
    return { status: "unavailable" };
  }

  const supabaseUrl = (
    import.meta.env.VITE_SUPABASE_URL as string | undefined
  )?.replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
    string | undefined;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Public recording service is unavailable.");
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/public-recording?recording_id=${encodeURIComponent(normalizedId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        apikey: anonKey,
      },
    },
  );

  if (response.status === 404) {
    return { status: "unavailable" };
  }

  if (!response.ok) {
    throw new Error("Public recording service is unavailable.");
  }

  const parsed = publicRecordingSchema.safeParse(await response.json());

  if (
    !parsed.success ||
    parsed.data.recording_id.toLowerCase() !== normalizedId
  ) {
    throw new Error("Public recording response was invalid.");
  }

  const recording: PublicRecordingPayload = {
    recording_id: parsed.data.recording_id,
    call_name: parsed.data.call_name,
    recording_start_time: parsed.data.recording_start_time,
    duration: parsed.data.duration,
    full_transcript: parsed.data.full_transcript,
  };

  return {
    status: "available",
    recording,
  };
}

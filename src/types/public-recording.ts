export interface PublicRecordingPayload {
  recording_id: string;
  call_name: string;
  recording_start_time: string | null;
  duration: number | null;
  full_transcript: string | null;
}

export type PublicRecordingResult =
  | {
      status: "available";
      recording: PublicRecordingPayload;
    }
  | {
      status: "unavailable";
    };

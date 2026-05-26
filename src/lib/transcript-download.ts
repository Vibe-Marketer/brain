/**
 * Transcript download helpers.
 *
 * Pure helpers extracted from `SyncTab.tsx` so they can be shared by anything
 * that downloads an unsynced meeting (sync tab today; could be wired into
 * call-detail tomorrow). No React, no Supabase, no DOM mutation beyond the
 * blob/anchor click that the browser literally requires to trigger a download.
 *
 * If you find yourself reaching for `useState`/`useEffect`/`useRef`, you're in
 * the wrong file.
 */

import type { Meeting } from "@/hooks/useMeetingsSync";
import type { IntegrationPlatform } from "@/lib/integration-platforms";

/**
 * Triggers a browser file download for a `.txt` blob with the supplied
 * `title` (non-alphanumerics replaced with `_`).
 */
export function downloadTextFile({
  title,
  contents,
}: {
  title: string;
  contents: string;
}): void {
  const blob = new Blob([contents], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[^a-z0-9]/gi, "_")}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Formats the raw `fetch-single-meeting` Fathom payload into the timestamped
 * plain-text transcript dump used by the download flow.
 */
export function formatFathomUnsyncedTranscript(meeting: unknown): string {
  const meetingRecord =
    meeting && typeof meeting === "object"
      ? (meeting as {
          title?: string;
          url?: string;
          transcript?: unknown;
        })
      : null;
  let transcript = `${meetingRecord?.title ?? "Untitled meeting"}\n`;
  transcript += `VIEW RECORDING - ${meetingRecord?.url || "N/A"}\n\n`;
  transcript += "---\n\n";

  if (Array.isArray(meetingRecord?.transcript)) {
    for (const segment of meetingRecord.transcript as Array<{
      timestamp?: string;
      speaker?: { display_name?: string };
      text?: string;
    }>) {
      const timestamp = segment.timestamp || "00:00:00";
      const speaker = segment.speaker?.display_name || "Unknown";
      const text = segment.text || "";
      transcript += `${timestamp} - ${speaker}\n`;
      transcript += `  ${text}\n\n`;
    }
    return transcript;
  }

  return `${transcript}No transcript available\n`;
}

/**
 * Formats a non-Fathom (connector-search-result) meeting into a plain-text
 * dump. We only have the search-result fields here — no provider-side fetch
 * — so the contents are intentionally lean.
 */
export function formatConnectorUnsyncedMeeting(
  meeting: Meeting,
  platform: IntegrationPlatform,
): string {
  const lines = [
    meeting.title,
    `SOURCE - ${platform}`,
    `RECORDING ID - ${meeting.recording_id}`,
    `STARTED AT - ${meeting.recording_start_time || meeting.created_at || "N/A"}`,
  ];

  if (meeting.share_url || meeting.url) {
    lines.push(`VIEW RECORDING - ${meeting.share_url || meeting.url}`);
  }
  if (meeting.summary) {
    lines.push("", "---", "", meeting.summary);
  }
  if (meeting.full_transcript) {
    lines.push("", "---", "", meeting.full_transcript);
  }

  return `${lines.join("\n")}\n`;
}

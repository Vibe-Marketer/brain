import {
  RiCalendarLine,
  RiFileTextLine,
  RiLockLine,
  RiTimeLine,
} from "@remixicon/react";
import { useParams } from "react-router-dom";

import { Spinner } from "@/components/ui/spinner";
import { usePublicRecording } from "@/hooks/usePublicRecording";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function UnavailableState({ isError }: { isError: boolean }) {
  return (
    <main
      className="min-h-screen bg-viewport flex items-center justify-center px-4"
      role={isError ? "alert" : undefined}
    >
      <section
        className="w-full max-w-md text-center"
        aria-labelledby="unavailable-title"
      >
        <RiLockLine
          className="mx-auto mb-4 h-14 w-14 text-muted-foreground"
          aria-hidden="true"
        />
        <h1
          id="unavailable-title"
          className="text-2xl font-semibold text-foreground"
        >
          This recording is not available.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may be incorrect, or the recording may no longer be public.
        </p>
      </section>
    </main>
  );
}

export function PublicRecordingView() {
  const { recordingId } = useParams<{ recordingId: string }>();
  const { data, isLoading, isError } = usePublicRecording(recordingId);

  if (isLoading) {
    return (
      <main
        className="min-h-screen bg-viewport flex items-center justify-center"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading public recording…
          </p>
        </div>
      </main>
    );
  }

  if (!recordingId || isError || !data) {
    return <UnavailableState isError={isError} />;
  }

  return (
    <main className="min-h-screen bg-viewport px-4 py-10 sm:px-6">
      <article className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <header className="border-b border-border px-6 py-7 sm:px-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Public recording
          </p>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {data.call_name}
          </h1>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {data.recording_start_time ? (
              <span className="inline-flex items-center gap-2">
                <RiCalendarLine className="h-4 w-4" aria-hidden="true" />
                {formatDate(data.recording_start_time)}
              </span>
            ) : null}
            {data.duration !== null ? (
              <span className="inline-flex items-center gap-2">
                <RiTimeLine className="h-4 w-4" aria-hidden="true" />
                {formatDuration(data.duration)}
              </span>
            ) : null}
          </div>
        </header>

        <section
          className="px-6 py-7 sm:px-8"
          aria-labelledby="transcript-heading"
        >
          <div className="mb-5 flex items-center gap-2">
            <RiFileTextLine
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
            <h2
              id="transcript-heading"
              className="text-lg font-semibold text-foreground"
            >
              Transcript
            </h2>
          </div>
          {data.full_transcript ? (
            <div className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
              {data.full_transcript}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              A transcript is not available for this recording.
            </p>
          )}
        </section>
      </article>
    </main>
  );
}

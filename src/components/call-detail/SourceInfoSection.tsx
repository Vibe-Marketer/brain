import { useState } from 'react';
import { format } from 'date-fns';
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
} from '@remixicon/react';
import { getSourcePlatformIcon } from '@/components/transcript-library/SourcePlatformIcons';
import { getCanonicalDisplaySource } from '@/lib/source-display';
import type { RawCallData, FathomRawCall, ZoomRawCall, YouTubeRawCall, UploadRawFile } from '@/types/raw-calls';

interface SourceInfoSectionProps {
  sourceApp: string | null | undefined;
  rawData: RawCallData | null | undefined;
  sourceMetadata?: Record<string, unknown> | null | undefined;
  isLoading: boolean;
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{label}</dt>
      <dd className="text-sm text-foreground">{String(value)}</dd>
    </div>
  );
}

function MetaLinkRow({ label, href }: { label: string; href: string | null | undefined }) {
  if (!href) return null;
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{label}</dt>
      <dd className="text-sm">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline truncate block"
        >
          {href}
        </a>
      </dd>
    </div>
  );
}

function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null) return null;
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function safeFormat(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    return format(new Date(dateStr), 'PPp');
  } catch {
    return dateStr;
  }
}

function formatMetadataLabel(key: string): string {
  return key
    .replace("source_platform", "Source")
    .replace("import_method", "Import Method")
    .replace("paste_source", "Import Format")
    .replace("duration_seconds", "Duration")
    .replace(/^(read_ai|fireflies|grain|plaud)_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetadataValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "duration_seconds" && typeof value === "number" && value > 0) {
    return `${Math.round(value / 60)} min`;
  }
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (Array.isArray(value)) {
    const primitiveValues = value.filter(
      (item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean",
    );
    if (primitiveValues.length === 0) return null;
    return primitiveValues.map(String).join(", ");
  }
  return null;
}

function SourceMetadataFields({
  metadata,
}: {
  metadata: Record<string, unknown>;
}) {
  const priority = [
    "source_platform",
    "import_method",
    "paste_source",
    "source_url",
    "share_url",
    "duration_seconds",
    "transcript_speaker_names",
    "calendar_invitees",
    "pasted_at",
  ];
  const rows = Object.entries(metadata)
    .map(([key, value]) => ({
      key,
      label: formatMetadataLabel(key),
      value: formatMetadataValue(key, value),
    }))
    .filter((row) => row.value)
    .sort((left, right) => {
      const leftIndex = priority.indexOf(left.key);
      const rightIndex = priority.indexOf(right.key);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    })
    .slice(0, 8);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No source details available</p>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
      {rows.map((row) =>
        row.value?.startsWith("http://") || row.value?.startsWith("https://") ? (
          <MetaLinkRow key={row.key} label={row.label} href={row.value} />
        ) : (
          <MetaRow key={row.key} label={row.label} value={row.value} />
        ),
      )}
    </dl>
  );
}

function FathomFields({ data }: { data: FathomRawCall }) {
  const recordedBy = [data.recorded_by_name, data.recorded_by_email]
    .filter(Boolean)
    .join(' — ') || null;
  const invitees = data.calendar_invitees?.length
    ? data.calendar_invitees.map((i) => i.name || i.email).join(', ')
    : null;

  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
      <MetaRow label="Recorded By" value={recordedBy} />
      <MetaRow label="Invitees" value={invitees} />
      <MetaLinkRow label="Fathom URL" href={data.url} />
      <MetaRow label="Synced At" value={safeFormat(data.synced_at)} />
    </dl>
  );
}

function ZoomFields({ data }: { data: ZoomRawCall }) {
  const meetingId = data.zoom_meeting_id || data.zoom_numeric_id || null;
  const duration = data.duration != null ? `${data.duration} min` : null;
  const participants = Array.isArray(data.participants)
    ? `${data.participants.length} participants`
    : null;

  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
      <MetaRow label="Meeting ID" value={meetingId} />
      <MetaRow label="Host" value={data.host_email} />
      <MetaRow label="Duration" value={duration} />
      <MetaRow label="Topic" value={data.topic} />
      <MetaRow label="Participants" value={participants} />
      <MetaLinkRow label="Recording URL" href={data.recording_url} />
      <MetaRow label="Synced At" value={safeFormat(data.synced_at)} />
    </dl>
  );
}

function YouTubeFields({ data }: { data: YouTubeRawCall }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
      <MetaRow label="Video ID" value={data.youtube_video_id} />
      <MetaRow label="Channel" value={data.youtube_channel_title} />
      <MetaRow label="Published" value={safeFormat(data.youtube_published_at)} />
      <MetaRow label="Views" value={data.youtube_view_count?.toLocaleString() ?? null} />
      <MetaRow label="Likes" value={data.youtube_like_count?.toLocaleString() ?? null} />
      <MetaRow label="Comments" value={data.youtube_comment_count?.toLocaleString() ?? null} />
      <MetaRow label="Duration" value={data.youtube_duration} />
    </dl>
  );
}

function UploadFields({ data }: { data: UploadRawFile }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
      <MetaRow label="Filename" value={data.original_filename} />
      <MetaRow label="Size" value={formatBytes(data.file_size)} />
      <MetaRow label="Type" value={data.mime_type} />
      <MetaRow label="Uploaded" value={safeFormat(data.created_at)} />
    </dl>
  );
}

const SOURCE_DETAIL_RENDERERS: Record<
  string,
  (props: { data: RawCallData }) => React.ReactNode
> = {
  fathom: ({ data }) => <FathomFields data={data as FathomRawCall} />,
  zoom: ({ data }) => <ZoomFields data={data as ZoomRawCall} />,
  youtube: ({ data }) => <YouTubeFields data={data as YouTubeRawCall} />,
  'file-upload': ({ data }) => <UploadFields data={data as UploadRawFile} />,
};

function SourceDetails({
  sourceApp,
  rawData,
  sourceMetadata,
}: {
  sourceApp: string | null | undefined;
  rawData: RawCallData | null | undefined;
  sourceMetadata?: Record<string, unknown> | null | undefined;
}) {
  const canonicalSource = sourceApp
    ? getCanonicalDisplaySource(sourceApp)
    : null;
  const Renderer = canonicalSource
    ? SOURCE_DETAIL_RENDERERS[canonicalSource]
    : undefined;

  if (Renderer && rawData) {
    return <Renderer data={rawData} />;
  }

  if (sourceMetadata) {
    return <SourceMetadataFields metadata={sourceMetadata} />;
  }

  if (!Renderer || !rawData) {
    return (
      <p className="text-sm text-muted-foreground">No source details available</p>
    );
  }
}

function SourceIcon({ sourceApp }: { sourceApp: string | null | undefined }) {
  if (!sourceApp) return null;
  const Icon = getSourcePlatformIcon(sourceApp);
  return <Icon className="h-4 w-4 text-muted-foreground" />;
}

export function SourceInfoSection({
  sourceApp,
  rawData,
  sourceMetadata,
  isLoading,
}: SourceInfoSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border-t border-border pt-4 mt-4 px-6 pb-2">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between mb-3"
      >
        <div className="flex items-center gap-2">
          <SourceIcon sourceApp={sourceApp} />
          <h3 className="font-display text-sm font-extrabold uppercase">SOURCE INFO</h3>
        </div>
        {isOpen ? (
          <RiArrowUpSLine className="h-4 w-4 text-muted-foreground" />
        ) : (
          <RiArrowDownSLine className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <SourceDetails
              sourceApp={sourceApp}
              rawData={rawData}
              sourceMetadata={sourceMetadata}
            />
          )}
        </div>
      )}
    </div>
  );
}

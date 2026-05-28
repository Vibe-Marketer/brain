import { Dispatch, SetStateAction } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RiExternalLinkLine, RiLinkM } from "@remixicon/react";
import ReactMarkdown from "react-markdown";
import { Meeting, Category, Speaker } from "@/types";
import { SourceInfoSection } from "@/components/call-detail/SourceInfoSection";
import type { RawCallData } from "@/types/raw-calls";
import { resolveShareUrl } from "@/lib/recording-source-url";

interface CallOverviewTabProps {
  call: Meeting;
  duration: number | null;
  callSpeakers: Speaker[];
  callCategories: Category[];
  isEditing: boolean;
  editedSummary: string;
  setEditedSummary: Dispatch<SetStateAction<string>>;
  sourceApp?: string | null;
  rawCallData?: RawCallData | null;
  rawCallLoading?: boolean;
}

interface SourcePreviewMetadata {
  source_url?: string;
  provider_name?: string;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  author_name?: string;
  created_at?: string;
  duration_seconds?: number;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const num = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(num) ? num : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getSourcePreviewMetadata(call: Meeting): SourcePreviewMetadata | null {
  const sourceMetadata = readRecord(call.source_metadata);
  if (!sourceMetadata) return null;
  const rawMetadata =
    readRecord(sourceMetadata.source_link_metadata) ??
    readRecord(sourceMetadata.loom_metadata);
  if (!rawMetadata) return null;

  const preview: SourcePreviewMetadata = {
    source_url: readString(rawMetadata.source_url) ?? resolveShareUrl(call) ?? undefined,
    provider_name: readString(rawMetadata.provider_name),
    title: readString(rawMetadata.title),
    description: readString(rawMetadata.description),
    thumbnail_url: readString(rawMetadata.thumbnail_url),
    author_name: readString(rawMetadata.author_name),
    created_at: readString(rawMetadata.created_at),
    duration_seconds: readNumber(rawMetadata.duration_seconds),
  };

  return preview.title || preview.description || preview.thumbnail_url ? preview : null;
}

function formatPreviewDuration(seconds: number | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
}

function formatPreviewDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

export function CallOverviewTab({
  call,
  duration,
  callSpeakers,
  callCategories,
  isEditing,
  editedSummary,
  setEditedSummary,
  sourceApp,
  rawCallData,
  rawCallLoading,
}: CallOverviewTabProps) {
  const sourcePreview = getSourcePreviewMetadata(call);
  const sourcePreviewMeta = sourcePreview
    ? [
        sourcePreview.provider_name,
        sourcePreview.author_name,
        formatPreviewDate(sourcePreview.created_at),
        formatPreviewDuration(sourcePreview.duration_seconds),
      ].filter(Boolean).join(" · ")
    : "";

  return (
    <TabsContent value="overview" className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-6 pt-6 pl-6 pr-4 pb-6">
          <div className="px-6 pb-6 border-b border-border">
            <h3 className="font-display text-sm font-extrabold uppercase mb-4">
              CALL DETAILS
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              {/* Left Column - Date & Duration */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs font-medium uppercase text-muted-foreground/60">
                    DATE
                  </Label>
                  <p className="text-sm font-medium">
                    {new Date(call.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium uppercase text-muted-foreground/60">
                    DURATION
                  </Label>
                  <p className="text-sm font-medium">
                    {duration ? `${duration} minutes` : "Not available"}
                  </p>
                </div>
              </div>

              {/* Right Column - Share Link & Recording ID */}
              <div className="space-y-4">
                {call.source_metadata?.import_method === "manual" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium uppercase text-muted-foreground/60">
                      SOURCE
                    </Label>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                      <RiLinkM className="h-3 w-3" aria-hidden="true" />
                      <span>
                        Manual import
                        {sourceApp === "zoom" ? " · Zoom VTT" : ""}
                      </span>
                    </div>
                  </div>
                )}
                {call.source_platform === "fathom-paste" && call.source_metadata?.import_method !== "manual" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium uppercase text-muted-foreground/60">
                      SOURCE
                    </Label>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                      <RiLinkM className="h-3 w-3" aria-hidden="true" />
                      <span>From Fathom share link</span>
                    </div>
                  </div>
                )}
                {(() => {
                  const url = resolveShareUrl(call);
                  if (!url) return null;
                  return (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium uppercase text-muted-foreground/60">
                        SHARE LINK
                      </Label>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-accent-blue hover:underline truncate block"
                      >
                        {url}
                      </a>
                    </div>
                  );
                })()}
                <div className="space-y-1">
                  <Label className="text-xs font-medium uppercase text-muted-foreground/60">
                    RECORDING ID
                  </Label>
                  <p className="text-sm font-mono">{call.recording_id}</p>
                </div>
              </div>

              {/* Second Row - Invitees & Participants */}
              {/* Zoom doesn't have calendar invitees — hide to avoid showing misleading "0 invited" */}
              {sourceApp !== "zoom" && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium uppercase text-muted-foreground/60">
                    NUMBER OF INVITEES
                  </Label>
                  <p className="text-sm font-medium">
                    {call.calendar_invitees?.length || 0} invited
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs font-medium uppercase text-muted-foreground/60">
                  PARTICIPANTS (SPEAKERS)
                </Label>
                <p className="text-sm font-medium">
                  {callSpeakers?.length || 0} spoke
                </p>
              </div>

              {/* Bottom Row - Categories & Folders */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase text-muted-foreground/60">
                  FOLDERS
                </Label>
                <div className="flex flex-wrap gap-2">
                  {callCategories && callCategories.length > 0 ? (
                    callCategories.map((category) => (
                      <Badge
                        key={category.id}
                        variant="hollow"
                        className="text-xs"
                      >
                        {category.icon && (
                          <span className="mr-1">{category.icon}</span>
                        )}
                        {category.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No folders assigned
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {sourcePreview && (
            <div className="px-6 pb-6 border-b border-border">
              <h3 className="font-display text-sm font-extrabold uppercase mb-4">
                SOURCE PREVIEW
              </h3>
              <div className="flex gap-4 rounded-lg border border-border bg-card p-4">
                {sourcePreview.thumbnail_url && (
                  <img
                    src={sourcePreview.thumbnail_url}
                    alt=""
                    className="h-24 w-36 flex-shrink-0 rounded-md object-cover border border-border/60 bg-muted"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    {sourcePreviewMeta && (
                      <p className="text-xs uppercase tracking-wide text-muted-foreground/60">
                        {sourcePreviewMeta}
                      </p>
                    )}
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {sourcePreview.title ?? "Source link"}
                    </p>
                  </div>
                  {sourcePreview.description && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {sourcePreview.description}
                    </p>
                  )}
                  {sourcePreview.source_url && (
                    <a
                      href={sourcePreview.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-blue hover:underline"
                    >
                      Open source
                      <RiExternalLinkLine className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-extrabold uppercase">
                SUMMARY
              </h3>
            </div>
            {isEditing ? (
              <Textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                rows={12}
                placeholder="Add a summary..."
                className="min-h-[300px]"
              />
            ) : (
              <div className="p-6 max-w-full overflow-hidden border border-border rounded-lg bg-card">
                <div className="prose prose-sm max-w-none break-words overflow-wrap-anywhere text-foreground [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-4 [&_h1]:mt-6 [&_h1:first-child]:mt-0 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:space-y-2 [&_li]:leading-relaxed [&_a]:text-accent-blue [&_a]:underline hover:[&_a]:opacity-80">
                  {call.summary ? (
                    <ReactMarkdown>{call.summary}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground/60 text-center py-8">
                      No summary available
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <SourceInfoSection
            sourceApp={sourceApp}
            rawData={rawCallData}
            sourceMetadata={call.source_metadata}
            isLoading={rawCallLoading ?? false}
          />
        </div>
      </ScrollArea>
    </TabsContent>
  );
}

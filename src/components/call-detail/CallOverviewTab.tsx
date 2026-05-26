import { Dispatch, SetStateAction } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RiLinkM } from "@remixicon/react";
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

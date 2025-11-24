import { memo } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RiDownloadLine, RiFileCopyLine, RiRefreshLine } from "@remixicon/react";
import { saveAs } from "file-saver";
import { TranscriptSegmentContextMenu } from "@/components/transcript-library/TranscriptSegmentContextMenu";
import { groupTranscriptsBySpeaker } from "@/lib/transcriptUtils";

/**
 * View state for the transcript tab - groups all UI state together
 */
export interface TranscriptViewState {
  includeTimestamps: boolean;
  viewRaw: boolean;
  editingSegmentId: string | null;
  editingText: string;
}

/**
 * Event handlers for transcript interactions - groups all callbacks together
 */
export interface TranscriptHandlers {
  onExport: (format: "txt" | "md" | "pdf" | "docx") => void;
  onCopyTranscript: () => void;
  onEditSegment: (segmentId: string, currentText: string) => void;
  onSaveEdit: (segmentId: string) => void;
  onCancelEdit: () => void;
  onChangeSpeaker: (segmentId: string, currentSpeaker: string, currentEmail?: string) => void;
  onTrimThis: (segmentId: string) => void;
  onTrimBefore: (segmentId: string) => void;
  onRevert: (segmentId: string) => void;
  onResyncCall: () => void;
}

/**
 * Data props for the transcript tab - groups all data together
 */
export interface TranscriptData {
  call: any;
  transcripts: any[];
  userSettings: any;
  callSpeakers: any[];
}

/**
 * Props for CallTranscriptTab component - reduced from 20 to 5 props using grouping
 *
 * @param viewState - UI state (timestamps, raw view, editing state)
 * @param onViewStateChange - Callback to update view state
 * @param handlers - Event handlers for transcript interactions
 * @param data - Call data, transcripts, speakers, and user settings
 * @param duration - Call duration in minutes (nullable)
 */
interface CallTranscriptTabProps {
  viewState: TranscriptViewState;
  onViewStateChange: (updates: Partial<TranscriptViewState>) => void;
  handlers: TranscriptHandlers;
  data: TranscriptData;
  duration: number | null;
}

/**
 * CallTranscriptTab - Displays call transcript with editing capabilities
 *
 * Optimized component that groups related props to reduce coupling and improve performance.
 * Uses React.memo to prevent unnecessary re-renders when parent updates unrelated state.
 */
export const CallTranscriptTab = memo(function CallTranscriptTab({
  viewState,
  onViewStateChange,
  handlers,
  data,
  duration,
}: CallTranscriptTabProps) {
  // Destructure grouped props for cleaner code
  const { includeTimestamps, viewRaw, editingSegmentId, editingText } = viewState;
  const { call, transcripts, userSettings, callSpeakers } = data;
  const {
    onExport,
    onCopyTranscript,
    onEditSegment,
    onSaveEdit,
    onCancelEdit,
    onChangeSpeaker,
    onTrimThis,
    onTrimBefore,
    onRevert,
    onResyncCall,
  } = handlers;

  // Helper to update view state
  const updateViewState = (key: keyof TranscriptViewState, value: any) => {
    onViewStateChange({ [key]: value });
  };
  return (
    <TabsContent value="transcript" className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="pr-4 pb-6">
          <Card className="p-6 max-w-full overflow-hidden">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">Metadata</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Database Name</Label>
                    <p className="font-medium">{call.title}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Recording ID</Label>
                    <p className="font-mono text-xs">{call.recording_id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <p>{new Date(call.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Duration</Label>
                    <p className="opacity-50">{duration ? `${duration} minutes` : "Not available"}</p>
                  </div>
                  {call.share_url && (
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Fathom Share Link</Label>
                      <a
                        href={call.share_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-blue hover:underline text-sm flex items-center gap-1"
                      >
                        {call.share_url}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Export Options</h3>
                </div>

                {/* Timestamp Toggle */}
                <div className="flex items-center justify-between p-4 mb-4 bg-muted/50 rounded-lg border">
                  <Label htmlFor="timestamp-toggle" className="text-sm font-medium cursor-pointer">
                    Include Timestamps
                  </Label>
                  <Switch
                    id="timestamp-toggle"
                    checked={includeTimestamps}
                    onCheckedChange={(value) => updateViewState('includeTimestamps', value)}
                  />
                </div>

                {/* Download Format Buttons */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="hollow"
                    size="sm"
                    onClick={() => onExport("txt")}
                    className="flex items-center gap-2"
                  >
                    <RiDownloadLine className="h-4 w-4" />
                    <span className="font-mono text-cb-ink-soft">.TXT</span>
                  </Button>
                  <Button
                    variant="hollow"
                    size="sm"
                    onClick={() => onExport("md")}
                    className="flex items-center gap-2"
                  >
                    <RiDownloadLine className="h-4 w-4" />
                    <span className="font-mono text-cb-ink-soft">.MD</span>
                  </Button>
                  <Button
                    variant="hollow"
                    size="sm"
                    onClick={() => onExport("pdf")}
                    className="flex items-center gap-2"
                  >
                    <RiDownloadLine className="h-4 w-4" />
                    <span className="font-mono text-cb-ink-soft">.PDF</span>
                  </Button>
                  <Button
                    variant="hollow"
                    size="sm"
                    onClick={() => onExport("docx")}
                    className="flex items-center gap-2"
                  >
                    <RiDownloadLine className="h-4 w-4" />
                    <span className="font-mono text-cb-ink-soft">.DOCX</span>
                  </Button>
                  <Button
                    variant="hollow"
                    size="sm"
                    onClick={onCopyTranscript}
                    className="ml-auto"
                  >
                    <RiFileCopyLine className="h-4 w-4 mr-2" />
                    <span className="font-mono text-xs">COPY</span>
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Full Transcript</h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="view-raw-toggle" className="text-xs font-medium cursor-pointer text-muted-foreground">
                      View RAW
                    </Label>
                    <Switch
                      id="view-raw-toggle"
                      checked={viewRaw}
                      onCheckedChange={(value) => updateViewState('viewRaw', value)}
                      className="scale-75"
                    />
                  </div>
                </div>
                <div className="h-[300px] rounded-md border overflow-y-auto">
                  <div className="space-y-6 py-4 px-4 bg-background">
                    {transcripts && transcripts.length > 0 ? (
                      (() => {
                        // Determine host email for blue bubble: prefer explicit host_email,
                        // but fall back to recorded_by_email from the call if needed.
                        const hostEmail = (
                          userSettings?.host_email ||
                          call.recorded_by_email ||
                          ""
                        )
                          .toString()
                          .toLowerCase() || null;

                        const groups = groupTranscriptsBySpeaker(transcripts);

                        return groups.map((group, groupIndex) => {
                          const speakerEmail = group.email?.toLowerCase();
                          const isHost = (hostEmail && speakerEmail && speakerEmail === hostEmail);

                          return (
                            <div
                              key={groupIndex}
                              className={`flex ${isHost ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[70%] ${isHost ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                                <div className="flex items-center gap-2 px-3">
                                  <span className={`text-xs font-medium ${isHost ? 'text-right' : 'text-left'} text-gray-600 dark:text-gray-400`}>
                                    {group.speaker || "Unknown"}
                                  </span>
                                  {group.messages[0].timestamp && (
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                      {group.messages[0].timestamp}
                                    </span>
                                  )}
                                </div>
                                  {group.messages.map((message, msgIndex) => (
                                     <div
                                       key={message.id || msgIndex}
                                       className={`flex items-center gap-2 ${isHost ? 'flex-row-reverse' : 'flex-row'} group/message`}
                                     >
                                      <div
                                        className={`relative rounded-[18px] px-4 py-2 ${
                                          isHost
                                            ? 'bg-[#007AFF] dark:bg-[#0A84FF] text-white rounded-br-[4px]'
                                            : 'bg-[#F8F8F8] dark:bg-[#2A2A2A] text-cb-ink rounded-bl-[4px]'
                                        }`}
                                      >
                                      {editingSegmentId === message.id ? (
                                        <div className="space-y-2">
                                          <Textarea
                                            value={editingText}
                                            onChange={(e) => updateViewState('editingText', e.target.value)}
                                            className="min-h-[60px] text-[15px] leading-[20px]"
                                          />
                                          <div className="flex gap-2">
                                            <Button size="sm" onClick={() => onSaveEdit(message.id)}>
                                              Save
                                            </Button>
                                            <Button size="sm" variant="hollow" onClick={onCancelEdit}>
                                              Cancel
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <p className="text-[15px] leading-[20px]">{message.display_text}</p>
                                          {message.has_edits && (
                                            <Badge variant="secondary" className="absolute -top-2 -right-2 text-[10px] px-1 py-0">
                                              Edited
                                            </Badge>
                                          )}
                                        </>
                                      )}
                                    </div>
                                    {editingSegmentId !== message.id && (
                                      <div className="opacity-70 group-hover/message:opacity-100 transition-opacity">
                                        <TranscriptSegmentContextMenu
                                          segmentId={message.id}
                                          hasEdits={message.has_edits}
                                          onEdit={() => onEditSegment(message.id, message.display_text)}
                                          onChangeSpeaker={() => onChangeSpeaker(message.id, message.display_speaker_name, message.display_speaker_email)}
                                          onTrimThis={() => onTrimThis(message.id)}
                                          onTrimBefore={() => onTrimBefore(message.id)}
                                          onRevert={() => onRevert(message.id)}
                                        />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()
                    ) : (
                      <Card className="p-8 text-center">
                        <p className="text-muted-foreground">No conversation available</p>
                      </Card>
                    )}
                  </div>
                </div>
              </div>

              {viewRaw && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Raw JSON Data</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="hollow"
                        size="sm"
                        onClick={() => {
                          try {
                            const jsonData = JSON.stringify({
                              call_metadata: call,
                              transcripts: transcripts,
                              speakers: callSpeakers,
                              calendar_invitees: call?.calendar_invitees,
                            }, null, 2);
                            const blob = new Blob([jsonData], { type: "application/json" });
                            saveAs(blob, `${call.title.replace(/[^a-z0-9]/gi, "_")}_raw_data.json`);
                            toast.success("JSON data exported");
                          } catch (error) {
                            toast.error("Failed to export JSON data");
                          }
                        }}
                        className="h-7 text-xs"
                      >
                        <RiDownloadLine className="h-3 w-3 mr-1" />
                        <span className="text-cb-ink-soft">.JSON</span>
                      </Button>
                      <Button
                        variant="hollow"
                        size="sm"
                        onClick={onResyncCall}
                        className="h-7 text-xs"
                      >
                        <RiRefreshLine className="h-3 w-3 mr-1" />
                        Re-sync
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[400px] w-full rounded-md border bg-muted/50 p-4">
                    <pre className="text-xs font-mono">
                      {JSON.stringify({ call, transcripts, speakers: callSpeakers }, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          </Card>
        </div>
      </ScrollArea>
    </TabsContent>
  );
});

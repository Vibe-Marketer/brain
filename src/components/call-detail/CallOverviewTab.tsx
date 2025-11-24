import { Dispatch, SetStateAction } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RiErrorWarningLine } from "@remixicon/react";
import ReactMarkdown from "react-markdown";

interface CallOverviewTabProps {
  call: any;
  duration: number | null;
  callSpeakers: any[];
  callCategories: any[];
  isEditing: boolean;
  editedSummary: string;
  setEditedSummary: Dispatch<SetStateAction<string>>;
}

export function CallOverviewTab({
  call,
  duration,
  callSpeakers,
  callCategories,
  isEditing,
  editedSummary,
  setEditedSummary,
}: CallOverviewTabProps) {
  return (
    <TabsContent value="overview" className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-6 pr-4 pb-6">
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-4">Call Details</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              {/* Left Column - Date & Duration */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="text-sm font-medium">{new Date(call.created_at).toLocaleDateString()}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Duration</Label>
                  <p className="text-sm font-medium">{duration ? `${duration} minutes` : "Not available"}</p>
                </div>
              </div>

              {/* Right Column - Share Link & Recording ID */}
              <div className="space-y-4">
                {call.share_url && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Fathom Share Link</Label>
                    <a
                      href={call.share_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent-blue hover:underline truncate block"
                    >
                      {call.share_url}
                    </a>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Recording ID</Label>
                  <p className="text-sm font-mono">{call.recording_id}</p>
                </div>
              </div>

              {/* Second Row - Invitees & Participants */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Number of Invitees</Label>
                <p className="text-sm font-medium">{call.calendar_invitees?.length || 0} invited</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Participants (Speakers)</Label>
                <p className="text-sm font-medium">{callSpeakers?.length || 0} spoke</p>
              </div>

              {/* Bottom Row - Categories & Tags */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Folders</Label>
                <div className="flex flex-wrap gap-2">
                  {callCategories && callCategories.length > 0 ? (
                    callCategories.map((category: any) => (
                      <Badge key={category.id} variant="hollow" className="text-xs">
                        {category.icon && <span className="mr-1">{category.icon}</span>}
                        {category.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No folders assigned</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Auto-Generated Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {call.auto_tags && call.auto_tags.length > 0 ? (
                    call.auto_tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No tags generated</span>
                  )}
                </div>
              </div>
            </div>

            {/* Show warning if critical data is missing */}
            {(!call.recording_start_time || !call.recording_end_time || !call.share_url) && (
              <div className="mt-4 p-3 bg-cb-warning-bg border border-cb-warning-border rounded-md text-cb-warning-text">
                <div className="flex gap-2 text-sm">
                  <RiErrorWarningLine className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Some meeting data is unavailable:</p>
                    <ul className="mt-1 text-xs space-y-0.5">
                      {!call.recording_start_time && <li>• Recording start time</li>}
                      {!call.recording_end_time && <li>• Recording end time</li>}
                      {!call.share_url && <li>• Fathom share link</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Summary</h3>
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
              <Card className="p-6 max-w-full overflow-hidden">
                <div className="prose prose-sm dark:prose-invert max-w-none break-words overflow-wrap-anywhere [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-4 [&_h1]:mt-6 [&_h1:first-child]:mt-0 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:space-y-2 [&_li]:leading-relaxed">
                  {call.summary ? (
                    <ReactMarkdown>{call.summary}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No summary available</p>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </ScrollArea>
    </TabsContent>
  );
}

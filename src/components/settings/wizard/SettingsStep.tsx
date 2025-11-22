import { Badge } from "@/components/ui/badge";
import { CheckboxCard } from "./CheckboxCard";

interface SettingsStepProps {
  myRecordings: boolean;
  externalRecordings: boolean;
  transcripts: boolean;
  summaries: boolean;
  actions: boolean;
  onMyRecordingsChange: (checked: boolean) => void;
  onExternalRecordingsChange: (checked: boolean) => void;
  onTranscriptsChange: (checked: boolean) => void;
  onSummariesChange: (checked: boolean) => void;
  onActionsChange: (checked: boolean) => void;
}

export function SettingsStep({
  myRecordings,
  externalRecordings,
  transcripts,
  summaries,
  actions,
  onMyRecordingsChange,
  onExternalRecordingsChange,
  onTranscriptsChange,
  onSummariesChange,
  onActionsChange,
}: SettingsStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm font-medium">
        Open your Fathom webhook settings and enable everything below. Then check the boxes here to confirm.
      </p>

      {/* Scopes */}
      <div className="space-y-3">
        <p className="font-semibold text-sm uppercase tracking-wide">Scopes</p>
        <div className="space-y-2">
          <CheckboxCard
            id="my-recordings"
            label="Internal Recordings"
            checked={myRecordings}
            onCheckedChange={onMyRecordingsChange}
            badge="Required"
            badgeVariant="required"
          />
          <CheckboxCard
            id="external-recordings"
            label="External Recordings"
            checked={externalRecordings}
            onCheckedChange={onExternalRecordingsChange}
            badge="Highly Recommended"
            badgeVariant="recommended"
          />
          {/* Coming Soon items */}
          <div className="flex items-center justify-between py-2 px-4 pl-6">
            <span className="text-sm text-muted-foreground">My Team Shared Recordings</span>
            <Badge variant="outline" className="rounded-full text-xs">Coming Soon</Badge>
          </div>
          <div className="flex items-center justify-between py-2 px-4 pl-6">
            <span className="text-sm text-muted-foreground">Team Recordings</span>
            <Badge variant="outline" className="rounded-full text-xs">Coming Soon</Badge>
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="space-y-3">
        <p className="font-semibold text-sm uppercase tracking-wide">Events</p>
        <div className="space-y-2">
          <CheckboxCard
            id="transcripts"
            label="Transcripts"
            checked={transcripts}
            onCheckedChange={onTranscriptsChange}
            badge="Required"
            badgeVariant="required"
          />
          <CheckboxCard
            id="summaries"
            label="Summaries"
            checked={summaries}
            onCheckedChange={onSummariesChange}
            badge="Recommended"
            badgeVariant="recommended"
          />
          <CheckboxCard
            id="actions"
            label="Action Items"
            checked={actions}
            onCheckedChange={onActionsChange}
            badge="Recommended"
            badgeVariant="recommended"
          />
          {/* Coming Soon */}
          <div className="flex items-center justify-between py-2 px-4 pl-6">
            <span className="text-sm text-muted-foreground">CRM Matches</span>
            <Badge variant="outline" className="rounded-full text-xs">Coming Soon</Badge>
          </div>
        </div>
      </div>

      {/* Helper text */}
      <div className="flex justify-center">
        <div className="bg-muted/30 border border-cb-border dark:border-cb-border-dark rounded-lg px-6 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            These boxes confirm you enabled settings in Fathom.<br />
            Checking them here doesn't change your Fathom account.
          </p>
        </div>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface TranscriptStats {
  words: number;
  characters: number;
  tokens: number;
}

interface CallStatsFooterProps {
  transcriptStats: TranscriptStats;
  hasTranscripts: boolean;
  onClose: () => void;
}

export function CallStatsFooter({
  transcriptStats,
  hasTranscripts,
  onClose
}: CallStatsFooterProps) {
  return (
    <DialogFooter className="flex-shrink-0 border-t pt-4 pb-2">
      <div className="flex items-center justify-between w-full">
        <div className="text-xs text-muted-foreground bg-background dark:bg-card border border-border px-3 py-1.5 rounded-md">
          {hasTranscripts && (
            <span>
              {transcriptStats.words.toLocaleString()} words | {transcriptStats.characters.toLocaleString()} characters | ~{transcriptStats.tokens.toLocaleString()} tokens
            </span>
          )}
        </div>
        <Button variant="hollow" onClick={onClose}>
          Close
        </Button>
      </div>
    </DialogFooter>
  );
}

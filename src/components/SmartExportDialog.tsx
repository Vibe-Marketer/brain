import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  RiFileTextLine,
  RiBookOpenLine,
  RiDatabaseLine,
  RiSparkling2Line,
  RiDownloadLine,
  RiCalendarLine,
  RiTeamLine,
  RiTimeLine
} from "@remixicon/react";
import { exportAsLLMContext, exportAsNarrative, exportAsAnalysisPackage, estimateTokens } from "@/lib/export-utils-advanced";
import { exportToPDF, exportToDOCX, exportToTXT, exportToJSON, exportToZIP } from "@/lib/export-utils";

interface SmartExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCalls: any[];
}

type ExportType = "individual" | "llm-context" | "narrative" | "analysis";
type ExportFormat = "pdf" | "docx" | "txt" | "json" | "zip";

export default function SmartExportDialog({
  open,
  onOpenChange,
  selectedCalls
}: SmartExportDialogProps) {
  const [exportType, setExportType] = useState<ExportType>("llm-context");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("txt");
  const [includeOptions, setIncludeOptions] = useState({
    summaries: true,
    transcripts: true,
    participants: true,
    metadata: true
  });

  const handleExport = () => {
    const calls = selectedCalls.map(call => ({
      ...call,
      recording_id: call.recording_id,
      title: call.title,
      created_at: call.created_at,
      summary: includeOptions.summaries ? call.summary : undefined,
      full_transcript: includeOptions.transcripts ? call.full_transcript : undefined,
      calendar_invitees: includeOptions.participants ? call.calendar_invitees : undefined,
      recorded_by_name: includeOptions.participants ? call.recorded_by_name : undefined,
      recorded_by_email: includeOptions.participants ? call.recorded_by_email : undefined,
      url: includeOptions.metadata ? call.url : undefined,
      recording_start_time: includeOptions.metadata ? call.recording_start_time : undefined,
      recording_end_time: includeOptions.metadata ? call.recording_end_time : undefined,
    }));

    if (exportType === "llm-context") {
      exportAsLLMContext(calls, { 
        transcripts: includeOptions.transcripts,
        metadata: includeOptions.metadata,
        summaries: includeOptions.summaries,
        participants: includeOptions.participants
      });
    } else if (exportType === "narrative") {
      exportAsNarrative(calls);
    } else if (exportType === "analysis") {
      exportAsAnalysisPackage(calls);
    } else {
      // Individual files
      switch (exportFormat) {
        case "pdf":
          exportToPDF(calls);
          break;
        case "docx":
          exportToDOCX(calls);
          break;
        case "txt":
          exportToTXT(calls);
          break;
        case "json":
          exportToJSON(calls);
          break;
        case "zip":
          exportToZIP(calls);
          break;
      }
    }

    onOpenChange(false);
  };

  // Calculate estimated tokens
  const totalTokens = selectedCalls.reduce((sum, call) => {
    let text = call.title || "";
    if (includeOptions.summaries && call.summary) text += call.summary;
    if (includeOptions.transcripts && call.full_transcript) text += call.full_transcript;
    return sum + estimateTokens(text);
  }, 0);

  // Date range
  const sortedCalls = [...selectedCalls].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const startDate = sortedCalls[0]?.created_at 
    ? new Date(sortedCalls[0].created_at).toLocaleDateString()
    : "";
  const endDate = sortedCalls[sortedCalls.length - 1]?.created_at 
    ? new Date(sortedCalls[sortedCalls.length - 1].created_at).toLocaleDateString()
    : "";

  // Calculate total participants
  const allParticipants = new Set<string>();
  selectedCalls.forEach(call => {
    if (call.recorded_by_name) allParticipants.add(call.recorded_by_name);
    if (call.calendar_invitees) {
      call.calendar_invitees.forEach((inv: any) => {
        if (inv.name) allParticipants.add(inv.name);
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiDownloadLine className="h-5 w-5" />
            Export {selectedCalls.length} Selected Meetings
          </DialogTitle>
          <DialogDescription>
            Choose how to export your meetings for analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Type Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Export Type</Label>
            <RadioGroup value={exportType} onValueChange={(v) => setExportType(v as ExportType)}>
              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="llm-context" id="llm-context" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="llm-context" className="flex items-center gap-2 cursor-pointer">
                    <RiSparkling2Line className="h-4 w-4 text-primary" />
                    <span className="font-semibold">LLM-Optimized Context</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Chronological format optimized for ChatGPT/Claude. Perfect for feeding AI with context.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="narrative" id="narrative" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="narrative" className="flex items-center gap-2 cursor-pointer">
                    <RiBookOpenLine className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Chronological Narrative</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Human-readable report organized by week and day. Great for reviewing.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="analysis" id="analysis" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="analysis" className="flex items-center gap-2 cursor-pointer">
                    <RiDatabaseLine className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Data Analysis Package</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Structured JSON with full metadata. Perfect for custom analysis or BI tools.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="individual" id="individual" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="individual" className="flex items-center gap-2 cursor-pointer">
                    <RiFileTextLine className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Individual Files</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Each meeting as a separate file. Choose format below.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Format Selection (only for individual) */}
          {exportType === "individual" && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Format</Label>
              <div className="flex gap-2">
                {(["pdf", "docx", "txt", "json", "zip"] as ExportFormat[]).map((format) => (
                  <Button
                    key={format}
                    variant={exportFormat === format ? "default" : "hollow"}
                    size="sm"
                    onClick={() => setExportFormat(format)}
                  >
                    {format.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Include Options */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Include</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="summaries"
                  checked={includeOptions.summaries}
                  onCheckedChange={(checked) =>
                    setIncludeOptions({ ...includeOptions, summaries: checked as boolean })
                  }
                />
                <Label htmlFor="summaries" className="cursor-pointer">
                  Summaries
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="transcripts"
                  checked={includeOptions.transcripts}
                  onCheckedChange={(checked) =>
                    setIncludeOptions({ ...includeOptions, transcripts: checked as boolean })
                  }
                />
                <Label htmlFor="transcripts" className="cursor-pointer">
                  Full Transcripts
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="participants"
                  checked={includeOptions.participants}
                  onCheckedChange={(checked) =>
                    setIncludeOptions({ ...includeOptions, participants: checked as boolean })
                  }
                />
                <Label htmlFor="participants" className="cursor-pointer">
                  Participant Information
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="metadata"
                  checked={includeOptions.metadata}
                  onCheckedChange={(checked) =>
                    setIncludeOptions({ ...includeOptions, metadata: checked as boolean })
                  }
                />
                <Label htmlFor="metadata" className="cursor-pointer">
                  Timestamps & URLs
                </Label>
              </div>
            </div>
          </div>

          {/* Preview Stats */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <RiCalendarLine className="h-4 w-4" />
                Date Range
              </span>
              <span className="font-medium">{startDate} - {endDate}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <RiTeamLine className="h-4 w-4" />
                Unique Participants
              </span>
              <span className="font-medium">{allParticipants.size}</span>
            </div>
            {includeOptions.transcripts && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <RiTimeLine className="h-4 w-4" />
                  Estimated Tokens
                </span>
                <span className="font-medium">~{totalTokens.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="hollow" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport}>
              <RiDownloadLine className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

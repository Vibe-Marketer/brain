import { useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  RiFileTextLine,
  RiDownloadLine,
  RiCalendarLine,
  RiTeamLine,
  RiTimeLine,
  RiFolderLine,
  RiPriceTag3Line,
  RiCalendarCheckLine,
  RiSparkling2Line,
  RiLoader4Line,
  RiMarkdownLine,
  RiTableLine,
  RiFileZipLine,
} from "@remixicon/react";
import { toast } from "sonner";
import {
  exportToPDF,
  exportToDOCX,
  exportToTXT,
  exportToJSON,
  exportToZIP,
  exportToMarkdown,
  exportToCSV,
  exportByWeek,
  exportByFolder,
  exportByTag,
} from "@/lib/export-utils";
import { exportAsLLMContext, estimateTokens } from "@/lib/export-utils-advanced";
import { generateMetaSummary } from "@/lib/api-client";
import { saveAs } from "file-saver";

interface SmartExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCalls: any[];
  // Optional: for folder/tag grouping
  folderAssignments?: Record<string, string[]>;
  folders?: Array<{ id: string; name: string; color: string }>;
  tagAssignments?: Record<string, string[]>;
  tags?: Array<{ id: string; name: string }>;
}

type OrganizationType = "single" | "individual" | "weekly" | "by-folder" | "by-tag";
type ExportFormat = "md" | "txt" | "pdf" | "docx" | "json" | "csv";

export default function SmartExportDialog({
  open,
  onOpenChange,
  selectedCalls,
  folderAssignments = {},
  folders = [],
  tagAssignments = {},
  tags = [],
}: SmartExportDialogProps) {
  const [organizationType, setOrganizationType] = useState<OrganizationType>("individual");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("md");
  const [includeOptions, setIncludeOptions] = useState({
    summaries: true,
    transcripts: true,
    participants: true,
    metadata: true,
  });
  const [generateAiSummary, setGenerateAiSummary] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);

  // Calculate stats
  const stats = useMemo(() => {
    const sortedCalls = [...selectedCalls].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const startDate = sortedCalls[0]?.created_at
      ? new Date(sortedCalls[0].created_at).toLocaleDateString()
      : "";
    const endDate = sortedCalls[sortedCalls.length - 1]?.created_at
      ? new Date(sortedCalls[sortedCalls.length - 1].created_at).toLocaleDateString()
      : "";

    // Unique participants
    const allParticipants = new Set<string>();
    selectedCalls.forEach((call) => {
      if (call.recorded_by_name) allParticipants.add(call.recorded_by_name);
      if (call.calendar_invitees && Array.isArray(call.calendar_invitees)) {
        call.calendar_invitees.forEach((inv: any) => {
          if (inv?.name) allParticipants.add(inv.name);
        });
      }
    });

    // Token estimate
    const totalTokens = selectedCalls.reduce((sum, call) => {
      let text = call.title || "";
      if (includeOptions.summaries && call.summary) text += call.summary;
      if (includeOptions.transcripts && call.full_transcript) text += call.full_transcript;
      return sum + estimateTokens(text);
    }, 0);

    // Weekly groups count
    const weekGroups = new Set<string>();
    selectedCalls.forEach((call) => {
      const date = new Date(call.created_at);
      const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
      weekGroups.add(weekKey);
    });

    // Folder groups
    const folderGroups = new Set<string>();
    selectedCalls.forEach((call) => {
      const callFolders = folderAssignments[call.recording_id] || [];
      callFolders.forEach((f) => folderGroups.add(f));
    });

    // Tag groups
    const tagGroups = new Set<string>();
    selectedCalls.forEach((call) => {
      const callTags = tagAssignments[call.recording_id] || [];
      callTags.forEach((t) => tagGroups.add(t));
    });

    return {
      startDate,
      endDate,
      participantCount: allParticipants.size,
      totalTokens,
      weekCount: weekGroups.size,
      folderCount: folderGroups.size,
      tagCount: tagGroups.size,
    };
  }, [selectedCalls, includeOptions, folderAssignments, tagAssignments]);

  // Get output description based on selection
  const outputDescription = useMemo(() => {
    const count = selectedCalls.length;
    const format = exportFormat.toUpperCase();

    switch (organizationType) {
      case "single":
        return `1 combined ${format} file with all ${count} meetings`;
      case "individual":
        return `ZIP with ${count} individual ${format} files`;
      case "weekly":
        return `ZIP with ${stats.weekCount} weekly folders containing ${format} files`;
      case "by-folder":
        return `ZIP organized by ${stats.folderCount || "assigned"} folders`;
      case "by-tag":
        return `ZIP organized by ${stats.tagCount || "assigned"} tags`;
      default:
        return "";
    }
  }, [organizationType, exportFormat, selectedCalls.length, stats]);

  const handleExport = async () => {
    setIsExporting(true);
    const loadingToast = toast.loading(`Exporting ${selectedCalls.length} meetings...`);

    try {
      // Prepare calls with include options
      const calls = selectedCalls.map((call) => ({
        ...call,
        summary: includeOptions.summaries ? call.summary : undefined,
        full_transcript: includeOptions.transcripts ? call.full_transcript : undefined,
        calendar_invitees: includeOptions.participants ? call.calendar_invitees : undefined,
        recorded_by_name: includeOptions.participants ? call.recorded_by_name : undefined,
        recorded_by_email: includeOptions.participants ? call.recorded_by_email : undefined,
        url: includeOptions.metadata ? call.url : undefined,
        recording_start_time: includeOptions.metadata ? call.recording_start_time : undefined,
        recording_end_time: includeOptions.metadata ? call.recording_end_time : undefined,
      }));

      // Generate AI meta-summary if requested
      let aiSummaryContent = "";
      if (generateAiSummary) {
        setIsGeneratingAiSummary(true);
        toast.loading("Generating AI meta-summary...", { id: loadingToast });

        const recordingIds = selectedCalls.map((c) => c.recording_id);
        const { data, error } = await generateMetaSummary({
          recording_ids: recordingIds,
          include_transcripts: includeOptions.transcripts,
        });

        if (error) {
          console.error("AI Summary error:", error);
          toast.warning("AI summary generation failed, continuing with export...");
        } else if (data) {
          const summary = data.meta_summary;
          aiSummaryContent = `# AI Meta-Summary\n\n`;
          aiSummaryContent += `**Meetings Analyzed:** ${data.meetings_analyzed}\n`;
          aiSummaryContent += `**Total Duration:** ${data.total_duration_minutes} minutes\n\n`;
          aiSummaryContent += `## Executive Summary\n\n${summary.executive_summary}\n\n`;

          if (summary.key_themes.length > 0) {
            aiSummaryContent += `## Key Themes\n\n`;
            summary.key_themes.forEach((theme) => {
              aiSummaryContent += `- ${theme}\n`;
            });
            aiSummaryContent += "\n";
          }

          if (summary.key_decisions.length > 0) {
            aiSummaryContent += `## Key Decisions\n\n`;
            summary.key_decisions.forEach((decision) => {
              aiSummaryContent += `- ${decision}\n`;
            });
            aiSummaryContent += "\n";
          }

          if (summary.action_items.length > 0) {
            aiSummaryContent += `## Action Items\n\n`;
            summary.action_items.forEach((item) => {
              aiSummaryContent += `- ${item}\n`;
            });
            aiSummaryContent += "\n";
          }

          if (summary.notable_insights.length > 0) {
            aiSummaryContent += `## Notable Insights\n\n`;
            summary.notable_insights.forEach((insight) => {
              aiSummaryContent += `- ${insight}\n`;
            });
            aiSummaryContent += "\n";
          }

          if (summary.participant_highlights.length > 0) {
            aiSummaryContent += `## Participant Highlights\n\n`;
            summary.participant_highlights.forEach((p) => {
              aiSummaryContent += `### ${p.name}\n`;
              p.key_contributions.forEach((c) => {
                aiSummaryContent += `- ${c}\n`;
              });
              aiSummaryContent += "\n";
            });
          }

          aiSummaryContent += `## Timeline Summary\n\n${summary.timeline_summary}\n`;
        }
        setIsGeneratingAiSummary(false);
      }

      toast.loading(`Creating export files...`, { id: loadingToast });

      // Execute export based on organization type
      switch (organizationType) {
        case "single":
          if (exportFormat === "csv") {
            await exportToCSV(calls);
          } else if (exportFormat === "md") {
            // For single markdown, export as LLM-optimized context
            exportAsLLMContext(calls, {
              transcripts: includeOptions.transcripts,
              metadata: includeOptions.metadata,
              summaries: includeOptions.summaries,
              participants: includeOptions.participants,
            });
          } else if (exportFormat === "txt") {
            await exportToTXT(calls);
          } else if (exportFormat === "pdf") {
            await exportToPDF(calls);
          } else if (exportFormat === "docx") {
            await exportToDOCX(calls);
          } else if (exportFormat === "json") {
            await exportToJSON(calls);
          }
          break;

        case "individual":
          if (exportFormat === "md") {
            await exportToMarkdown(calls, true);
          } else if (exportFormat === "csv") {
            await exportToCSV(calls);
          } else {
            await exportToZIP(calls);
          }
          break;

        case "weekly":
          await exportByWeek(calls, exportFormat === "md" ? "md" : "txt");
          break;

        case "by-folder":
          await exportByFolder(calls, folderAssignments, folders, exportFormat === "md" ? "md" : "txt");
          break;

        case "by-tag":
          await exportByTag(calls, tagAssignments, tags, exportFormat === "md" ? "md" : "txt");
          break;
      }

      // If AI summary was generated, save it separately
      if (aiSummaryContent) {
        const blob = new Blob([aiSummaryContent], { type: "text/markdown;charset=utf-8" });
        saveAs(blob, `ai-meta-summary-${new Date().toISOString().split("T")[0]}.md`);
      }

      toast.success(`Successfully exported ${selectedCalls.length} meetings`, { id: loadingToast });
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed. Please try again.", { id: loadingToast });
    } finally {
      setIsExporting(false);
      setIsGeneratingAiSummary(false);
    }
  };

  const formatButtons: { format: ExportFormat; label: string; icon: React.ReactNode }[] = [
    { format: "md", label: "Markdown", icon: <RiMarkdownLine className="h-3.5 w-3.5" /> },
    { format: "txt", label: "Text", icon: <RiFileTextLine className="h-3.5 w-3.5" /> },
    { format: "pdf", label: "PDF", icon: <RiFileTextLine className="h-3.5 w-3.5" /> },
    { format: "docx", label: "Word", icon: <RiFileTextLine className="h-3.5 w-3.5" /> },
    { format: "json", label: "JSON", icon: <RiFileTextLine className="h-3.5 w-3.5" /> },
    { format: "csv", label: "CSV", icon: <RiTableLine className="h-3.5 w-3.5" /> },
  ];

  // Filter formats based on organization type
  const availableFormats = useMemo(() => {
    if (organizationType === "single") {
      return formatButtons;
    } else if (organizationType === "weekly" || organizationType === "by-folder" || organizationType === "by-tag") {
      // Only MD and TXT for grouped exports
      return formatButtons.filter((f) => f.format === "md" || f.format === "txt");
    } else {
      // Individual: all except CSV (CSV is single table)
      return formatButtons.filter((f) => f.format !== "csv" || organizationType === "single");
    }
  }, [organizationType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiDownloadLine className="h-5 w-5" />
            Export {selectedCalls.length} Meetings
          </DialogTitle>
          <DialogDescription>Choose how to organize and format your export</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Organization Type */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">How to Organize</Label>
            <RadioGroup
              value={organizationType}
              onValueChange={(v) => {
                setOrganizationType(v as OrganizationType);
                // Reset format if not available
                if (v === "weekly" || v === "by-folder" || v === "by-tag") {
                  if (exportFormat !== "md" && exportFormat !== "txt") {
                    setExportFormat("md");
                  }
                }
              }}
              className="grid grid-cols-1 gap-2"
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="single" id="single" />
                <div className="flex-1">
                  <Label htmlFor="single" className="flex items-center gap-2 cursor-pointer">
                    <RiFileTextLine className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Single Bundle</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All meetings combined in one file
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="individual" id="individual" />
                <div className="flex-1">
                  <Label htmlFor="individual" className="flex items-center gap-2 cursor-pointer">
                    <RiFileZipLine className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Individual Files</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    One file per meeting in a ZIP archive
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="weekly" id="weekly" />
                <div className="flex-1">
                  <Label htmlFor="weekly" className="flex items-center gap-2 cursor-pointer">
                    <RiCalendarCheckLine className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Weekly Bundles</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {stats.weekCount} weeks
                    </Badge>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Organized by week with summary files
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="by-folder" id="by-folder" disabled={folders.length === 0} />
                <div className="flex-1">
                  <Label
                    htmlFor="by-folder"
                    className={`flex items-center gap-2 cursor-pointer ${folders.length === 0 ? "opacity-50" : ""}`}
                  >
                    <RiFolderLine className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">By Folder</span>
                    {stats.folderCount > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {stats.folderCount} folders
                      </Badge>
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {folders.length === 0 ? "No folders available" : "Grouped by folder assignment"}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="by-tag" id="by-tag" disabled={tags.length === 0} />
                <div className="flex-1">
                  <Label
                    htmlFor="by-tag"
                    className={`flex items-center gap-2 cursor-pointer ${tags.length === 0 ? "opacity-50" : ""}`}
                  >
                    <RiPriceTag3Line className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">By Tag</span>
                    {stats.tagCount > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {stats.tagCount} tags
                      </Badge>
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tags.length === 0 ? "No tags available" : "Grouped by tag assignment"}
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Output Format</Label>
            <div className="flex flex-wrap gap-2">
              {availableFormats.map(({ format, label, icon }) => (
                <Button
                  key={format}
                  variant={exportFormat === format ? "default" : "hollow"}
                  size="sm"
                  onClick={() => setExportFormat(format)}
                  className="gap-1.5"
                >
                  {icon}
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Include Options */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Include in Export</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="summaries"
                  checked={includeOptions.summaries}
                  onCheckedChange={(checked) =>
                    setIncludeOptions({ ...includeOptions, summaries: checked as boolean })
                  }
                />
                <Label htmlFor="summaries" className="text-sm cursor-pointer">
                  Meeting Summaries
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
                <Label htmlFor="transcripts" className="text-sm cursor-pointer">
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
                <Label htmlFor="participants" className="text-sm cursor-pointer">
                  Participant Info
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
                <Label htmlFor="metadata" className="text-sm cursor-pointer">
                  Timestamps & URLs
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* AI Meta-Summary Option */}
          <div className="flex items-start space-x-3 p-3 border rounded-lg bg-muted/30">
            <Checkbox
              id="ai-summary"
              checked={generateAiSummary}
              onCheckedChange={(checked) => setGenerateAiSummary(checked as boolean)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="ai-summary" className="flex items-center gap-2 cursor-pointer">
                <RiSparkling2Line className="h-4 w-4 text-primary" />
                <span className="font-medium">Generate AI Meta-Summary</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Creates an executive summary with key themes, decisions, action items, and insights across all
                selected meetings. Saved as a separate markdown file.
              </p>
            </div>
          </div>

          {/* Preview Stats */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <RiCalendarLine className="h-4 w-4" />
                Date Range
              </span>
              <span className="font-medium">
                {stats.startDate} - {stats.endDate}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <RiTeamLine className="h-4 w-4" />
                Unique Participants
              </span>
              <span className="font-medium">{stats.participantCount}</span>
            </div>
            {includeOptions.transcripts && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <RiTimeLine className="h-4 w-4" />
                  Estimated Tokens
                </span>
                <span className="font-medium">~{stats.totalTokens.toLocaleString()}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <RiFileZipLine className="h-4 w-4" />
                Output
              </span>
              <span className="font-medium text-primary">{outputDescription}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="hollow" onClick={() => onOpenChange(false)} disabled={isExporting}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                  {isGeneratingAiSummary ? "Generating AI Summary..." : "Exporting..."}
                </>
              ) : (
                <>
                  <RiDownloadLine className="mr-2 h-4 w-4" />
                  Export
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

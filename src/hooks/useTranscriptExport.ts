import { toast } from "sonner";
import { saveAs } from "file-saver";
import {
  buildObsidianMarkdown,
  buildObsidianVaultPath,
  exportSingleCallToObsidian,
  type ExportableCall,
} from "@/lib/export-utils";
import { resolveShareUrl } from "@/lib/recording-source-url";
import { groupTranscriptsBySpeaker, formatSimpleTimestamp } from "@/lib/transcriptUtils";
import { logger } from "@/lib/logger";
import type { CalendarInvitee } from "@/types/meetings";

interface UseTranscriptExportProps {
  call: {
    recording_id: string | number;
    canonical_uuid?: string;
    title: string;
    created_at: string;
    share_url?: string | null;
    source_metadata?: Record<string, unknown> | null;
    url?: string | null;
    full_transcript?: string | null;
    transcript_segments?: unknown;
    summary?: string | null;
    recorded_by_name?: string | null;
    recorded_by_email?: string | null;
    calendar_invitees?: CalendarInvitee[] | null;
    recording_start_time?: string | null;
    recording_end_time?: string | null;
    workspace_name?: string | null;
    tag_names?: string[];
  } | null;
  orgName?: string;
  workspaceName?: string;
  transcripts: Array<{
    timestamp?: string;
    display_text: string;
    display_speaker_name?: string;
  }>;
  duration: number | null;
  includeTimestamps: boolean;
}

export function useTranscriptExport({
  call,
  orgName = "My Organization",
  workspaceName,
  transcripts,
  duration,
  includeTimestamps
}: UseTranscriptExportProps) {
  /**
   * Format the loaded `transcripts` rows into readable text. The Obsidian export
   * (unlike txt/md/pdf/docx) was reading call.full_transcript/transcript_segments,
   * which are usually empty in the detail dialog — the live transcript is loaded
   * into the separate `transcripts` array. Falling back to it here is what makes
   * the Obsidian note's Transcript section populate instead of "not available".
   */
  const formatLoadedTranscript = (): string | null => {
    if (!transcripts || transcripts.length === 0) return null;
    const groups = groupTranscriptsBySpeaker(transcripts);
    return groups
      .map((group) => {
        const firstTimestamp = group.messages[0]?.timestamp;
        const stamp = firstTimestamp ? formatSimpleTimestamp(firstTimestamp) : "0:00";
        const speaker = group.speaker || "Unknown";
        const text = group.messages.map((m) => m.display_text).join(" ");
        return `**${speaker}** (${stamp})\n\n${text}`;
      })
      .join("\n\n");
  };

  const buildObsidianCall = (): ExportableCall | null => {
    if (!call) return null;
    return {
      recording_id: call.recording_id,
      canonical_uuid: call.canonical_uuid,
      title: call.title,
      created_at: call.created_at,
      recording_start_time: call.recording_start_time,
      recording_end_time: call.recording_end_time,
      recorded_by_name: call.recorded_by_name,
      recorded_by_email: call.recorded_by_email,
      calendar_invitees: call.calendar_invitees,
      // Prefer real segments/full_transcript when present; otherwise fall back to
      // the loaded `transcripts` array (same source the working txt/md export uses).
      full_transcript: call.full_transcript || formatLoadedTranscript(),
      transcript_segments: call.transcript_segments,
      summary: call.summary,
      url: resolveShareUrl(call) ?? call.url ?? null,
      workspace_name: call.workspace_name ?? workspaceName ?? "Uncategorized",
      tag_names: call.tag_names,
    };
  };

  const handleCopyTranscript = async () => {
    if (!call) {
      toast.error("No call available to copy");
      return;
    }

    if (!transcripts || transcripts.length === 0) {
      toast.error("No transcript available to copy");
      return;
    }

    try {
      // Title line with month name
      const date = new Date(call.created_at);
      const monthName = date.toLocaleString('en-US', { month: 'long' });
      const day = date.getDate();

      let transcriptText = `${call.title} - ${monthName} ${day}\n`;
      transcriptText += `VIEW RECORDING - ${duration || 'N/A'} mins (No highlights): \n\n`;
      transcriptText += `---\n\n`;

      // Group consecutive messages by speaker
      const groups = groupTranscriptsBySpeaker(transcripts);

      groups.forEach((group) => {
        // Get first timestamp of the group
        const firstTimestamp = group.messages[0].timestamp;
        const simpleTimestamp = firstTimestamp ? formatSimpleTimestamp(firstTimestamp) : '0:00';
        const speakerName = group.speaker || "Unknown";

        // Speaker line
        transcriptText += `${simpleTimestamp} - ${speakerName}\n`;

        // Consolidate all messages from this speaker into one paragraph
        const allText = group.messages
          .map(m => m.display_text)
          .join(' '); // Join with space to create flowing paragraph

        // Add text with 2-space indentation
        transcriptText += `  ${allText}\n\n`;
      });

      await navigator.clipboard.writeText(transcriptText);
      toast.success("Transcript copied to clipboard");
    } catch (error) {
      logger.error("Failed to copy transcript", error);
      toast.error("Failed to copy transcript");
    }
  };

  const handleExport = async (format: "txt" | "md" | "pdf" | "docx") => {
    if (!call) {
      toast.error("No call available to export");
      return;
    }

    if (!transcripts || transcripts.length === 0) {
      toast.error("No transcript available to export");
      return;
    }

    // Build transcript in Fathom format
    const date = new Date(call.created_at);
    const monthName = date.toLocaleString('en-US', { month: 'long' });
    const day = date.getDate();

    let fullTranscript = `${call.title} - ${monthName} ${day}\n`;
    fullTranscript += `VIEW RECORDING - ${duration || 'N/A'} mins (No highlights): \n\n`;
    fullTranscript += `---\n\n`;

    const groups = groupTranscriptsBySpeaker(transcripts);

    groups.forEach((group) => {
      const firstTimestamp = group.messages[0].timestamp;
      const simpleTimestamp = firstTimestamp ? formatSimpleTimestamp(firstTimestamp) : '0:00';
      const speakerName = group.speaker || "Unknown";

      fullTranscript += `${simpleTimestamp} - ${speakerName} (${speakerName})\n`;

      const allText = group.messages
        .map(m => m.display_text)
        .join(' ');

      fullTranscript += `  ${allText}\n\n`;
    });

    const metadata = `Title: ${call.title}\nRecording ID: ${call.recording_id}\nDate: ${new Date(call.created_at).toLocaleString()}\nDuration: ${duration ? `${duration} minutes` : "N/A"}\nFathom Share Link: ${call.share_url || "N/A"}\n\n---\n\n`;

    try {
      if (format === "txt" || format === "md") {
        const content = metadata + fullTranscript;
        const blob = new Blob([content], { type: "text/plain" });
        saveAs(blob, `${call.title.replace(/[^a-z0-9]/gi, "_")}_transcript.${format}`);
      } else if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        const maxWidth = pageWidth - 2 * margin;

        doc.setFontSize(10);
        const lines = doc.splitTextToSize(metadata + fullTranscript, maxWidth);
        doc.text(lines, margin, 20);
        doc.save(`${call.title.replace(/[^a-z0-9]/gi, "_")}_transcript.pdf`);
      } else if (format === "docx") {
        const { Document, Packer, Paragraph, TextRun } = await import("docx");
        // Build DOCX paragraphs with grouped speakers
        const paragraphs = [
          new Paragraph({
            children: [
              new TextRun({ text: `Title: ${call.title}`, bold: true }),
            ],
          }),
          new Paragraph({
            children: [new TextRun(`Recording ID: ${call.recording_id}`)],
          }),
          new Paragraph({
            children: [new TextRun(`Date: ${new Date(call.created_at).toLocaleString()}`)],
          }),
          new Paragraph({
            children: [new TextRun(`Duration: ${duration ? `${duration} minutes` : "N/A"}`)],
          }),
          new Paragraph({
            children: [new TextRun(`Fathom Share Link: ${call.share_url || "N/A"}`)],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "---" }),
          new Paragraph({ text: "" }),
        ];

        let currentSpeaker = "";
        transcripts.forEach((t, index: number) => {
          const speakerName = t.display_speaker_name || "Unknown";

          // Add speaker header when speaker changes
          if (speakerName !== currentSpeaker) {
            if (index > 0) {
              paragraphs.push(new Paragraph({ text: "" })); // Spacing between speakers
            }
            paragraphs.push(
              new Paragraph({
                children: [new TextRun({ text: `${speakerName}:`, bold: true })],
              })
            );
            currentSpeaker = speakerName;
          }

          // Add the message
          const timestamp = includeTimestamps && t.timestamp ? `[${t.timestamp}] ` : "";
          paragraphs.push(
            new Paragraph({
              children: [new TextRun(`${timestamp}${t.display_text}`)],
            })
          );
        });

        const doc = new Document({
          sections: [{
            children: paragraphs,
          }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${call.title.replace(/[^a-z0-9]/gi, "_")}_transcript.docx`);
      }
      toast.success(`Transcript exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to export transcript");
      logger.error("Export error", error);
    }
  };

  const handleExportObsidian = () => {
    const exportableCall = buildObsidianCall();
    if (!exportableCall) {
      toast.error("No call available to export");
      return;
    }

    const resolvedWorkspaceName = workspaceName ?? exportableCall.workspace_name ?? "Uncategorized";

    try {
      exportSingleCallToObsidian(exportableCall, {
        orgName,
        workspaceName: resolvedWorkspaceName,
      });
      toast.success("Obsidian note exported");
    } catch (error) {
      toast.error("Failed to export Obsidian note");
      logger.error("Obsidian export error", error);
    }
  };

  const handleCopyObsidianMarkdown = async () => {
    const exportableCall = buildObsidianCall();
    if (!exportableCall) {
      toast.error("No call available to copy");
      return;
    }

    const resolvedWorkspaceName = workspaceName ?? exportableCall.workspace_name ?? "Uncategorized";

    try {
      const vaultPath = buildObsidianVaultPath(exportableCall, orgName, resolvedWorkspaceName);
      const markdown = buildObsidianMarkdown(exportableCall, {
        orgName,
        workspaceName: resolvedWorkspaceName,
        syncedAt: new Date().toISOString(),
        vaultPath,
      });
      await navigator.clipboard.writeText(markdown);
      toast.success("Obsidian markdown copied");
    } catch (error) {
      toast.error("Failed to copy Obsidian markdown");
      logger.error("Obsidian markdown copy error", error);
    }
  };

  return {
    handleCopyTranscript,
    handleExport,
    handleExportObsidian,
    handleCopyObsidianMarkdown,
  };
}

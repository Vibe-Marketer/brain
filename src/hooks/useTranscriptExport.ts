import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { groupTranscriptsBySpeaker, formatSimpleTimestamp } from "@/lib/transcriptUtils";
import { logger } from "@/lib/logger";

interface UseTranscriptExportProps {
  call: any;
  transcripts: any[];
  duration: number | null;
  includeTimestamps: boolean;
}

export function useTranscriptExport({
  call,
  transcripts,
  duration,
  includeTimestamps
}: UseTranscriptExportProps) {

  const handleCopyTranscript = async () => {
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
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        const maxWidth = pageWidth - 2 * margin;

        doc.setFontSize(10);
        const lines = doc.splitTextToSize(metadata + fullTranscript, maxWidth);
        doc.text(lines, margin, 20);
        doc.save(`${call.title.replace(/[^a-z0-9]/gi, "_")}_transcript.pdf`);
      } else if (format === "docx") {
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
        transcripts.forEach((t: any, index: number) => {
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

  return {
    handleCopyTranscript,
    handleExport,
  };
}

import { useState } from "react";
import { RiDownloadLine } from "@remixicon/react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { logger } from "@/lib/logger";
import type { Meeting } from "@/types";

interface DownloadPopoverProps {
  call: Meeting;
}

export function DownloadPopover({ call }: DownloadPopoverProps) {
  const [open, setOpen] = useState(false);
  const [includeTimestamps, setIncludeTimestamps] = useState(() => {
    const saved = localStorage.getItem('transcript-include-timestamps');
    return saved ? JSON.parse(saved) : true;
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "txt" | "md" | "pdf" | "docx") => {
    setIsExporting(true);
    try {
      const { data: transcripts, error } = await supabase
        .from("fathom_transcripts")
        .select("*")
        .eq("recording_id", call.recording_id)
        .order("timestamp");

      if (error) throw error;

      if (!transcripts || transcripts.length === 0) {
        toast.error("No transcript available for this call");
        return;
      }

      interface TranscriptRow {
        timestamp?: string | null;
        speaker_name?: string | null;
        text: string;
      }

      const fullTranscript = (transcripts as TranscriptRow[])
        .map((t) => {
          const timestamp = includeTimestamps && t.timestamp ? `[${t.timestamp}] ` : "";
          return `${timestamp}${t.speaker_name || "Unknown"}: ${t.text}`;
        })
        .join("\n\n");

      const fileName = `${call.title.replace(/[^a-z0-9]/gi, '_')}_transcript`;

      switch (format) {
        case "txt": {
          const blob = new Blob([fullTranscript], { type: "text/plain" });
          saveAs(blob, `${fileName}.txt`);
          break;
        }

        case "md": {
          const mdContent = `# ${call.title}\n\n${fullTranscript}`;
          const mdBlob = new Blob([mdContent], { type: "text/markdown" });
          saveAs(mdBlob, `${fileName}.md`);
          break;
        }

        case "pdf": {
          const pdf = new jsPDF();
          const splitText = pdf.splitTextToSize(fullTranscript, 180);
          pdf.text(splitText, 15, 15);
          pdf.save(`${fileName}.pdf`);
          break;
        }

        case "docx": {
          const doc = new Document({
            sections: [{
              children: [
                new Paragraph({
                  children: [new TextRun({ text: call.title, bold: true, size: 28 })],
                }),
                new Paragraph({ children: [new TextRun("")] }),
                ...(transcripts as TranscriptRow[]).map((t) =>
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: includeTimestamps && t.timestamp ? `[${t.timestamp}] ` : "",
                        italics: true,
                      }),
                      new TextRun({
                        text: `${t.speaker_name || "Unknown"}: `,
                        bold: true,
                      }),
                      new TextRun(t.text),
                    ],
                  })
                ),
              ],
            }],
          });

          const buffer = await Packer.toBlob(doc);
          saveAs(buffer, `${fileName}.docx`);
          break;
        }
      }

      toast.success(`Transcript exported as ${format.toUpperCase()}`);
      setOpen(false);
    } catch (error) {
      logger.error("Export error", error);
      toast.error("Failed to export transcript");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-5 w-5 md:h-6 md:w-6 p-0 inline-flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors"
          title="Download transcript"
        >
          <RiDownloadLine className="h-3 w-3 md:h-3.5 md:w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="space-y-3">
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Switch
              id="timestamps"
              checked={includeTimestamps}
              onCheckedChange={(checked) => {
                setIncludeTimestamps(checked);
                localStorage.setItem('transcript-include-timestamps', JSON.stringify(checked));
              }}
            />
            <Label htmlFor="timestamps" className="text-sm cursor-pointer">
              Include timestamps
            </Label>
          </div>

          <div className="space-y-1">
            <button
              className="w-full justify-start text-sm px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
              onClick={() => handleExport("txt")}
              disabled={isExporting}
            >
              Plain Text (.txt)
            </button>
            <button
              className="w-full justify-start text-sm px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
              onClick={() => handleExport("md")}
              disabled={isExporting}
            >
              Markdown (.md)
            </button>
            <button
              className="w-full justify-start text-sm px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
              onClick={() => handleExport("pdf")}
              disabled={isExporting}
            >
              PDF (.pdf)
            </button>
            <button
              className="w-full justify-start text-sm px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
              onClick={() => handleExport("docx")}
              disabled={isExporting}
            >
              Word (.docx)
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

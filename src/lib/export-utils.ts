import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import JSZip from 'jszip';

interface Call {
  recording_id: number;
  title: string;
  created_at: string;
  recorded_by_name?: string;
  recorded_by_email?: string;
  full_transcript?: string;
  summary?: string;
  recording_start_time?: string;
  recording_end_time?: string;
  url?: string;
}

interface TranscriptSegment {
  speaker_name?: string;
  speaker_email?: string;
  text: string;
  timestamp?: string;
}

export async function exportToPDF(calls: Call[]) {
  const pdf = new jsPDF();
  let yPosition = 20;

  calls.forEach((call, index) => {
    if (index > 0) {
      pdf.addPage();
      yPosition = 20;
    }

    // Title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(call.title, 20, yPosition);
    yPosition += 10;

    // Metadata
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Date: ${new Date(call.created_at).toLocaleDateString()}`, 20, yPosition);
    yPosition += 6;
    
    if (call.recorded_by_name) {
      pdf.text(`Recorded by: ${call.recorded_by_name}`, 20, yPosition);
      yPosition += 6;
    }

    yPosition += 5;

    // Summary
    if (call.summary) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary:', 20, yPosition);
      yPosition += 6;
      pdf.setFont('helvetica', 'normal');
      
      const summaryLines = pdf.splitTextToSize(call.summary, 170);
      summaryLines.forEach((line: string) => {
        if (yPosition > 280) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, 20, yPosition);
        yPosition += 6;
      });
      yPosition += 5;
    }

    // Transcript
    if (call.full_transcript) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Transcript:', 20, yPosition);
      yPosition += 6;
      pdf.setFont('helvetica', 'normal');

      const transcriptLines = pdf.splitTextToSize(call.full_transcript, 170);
      transcriptLines.forEach((line: string) => {
        if (yPosition > 280) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, 20, yPosition);
        yPosition += 6;
      });
    }
  });

  const fileName = calls.length === 1 
    ? `${calls[0].title.replace(/[^a-z0-9]/gi, '_')}.pdf`
    : `transcripts_${new Date().toISOString().split('T')[0]}.pdf`;

  pdf.save(fileName);
}

export async function exportToDOCX(calls: Call[]) {
  const children: Paragraph[] = [];

  calls.forEach((call, index) => {
    if (index > 0) {
      children.push(new Paragraph({ text: '', spacing: { before: 400 } }));
    }

    // Title
    children.push(
      new Paragraph({
        text: call.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );

    // Metadata
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Date: ${new Date(call.created_at).toLocaleDateString()}`,
            size: 20,
          }),
        ],
        spacing: { after: 100 },
      })
    );

    if (call.recorded_by_name) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Recorded by: ${call.recorded_by_name}`,
              size: 20,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }

    // Summary
    if (call.summary) {
      children.push(
        new Paragraph({
          text: 'Summary',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
      children.push(
        new Paragraph({
          text: call.summary,
          spacing: { after: 200 },
        })
      );
    }

    // Transcript
    if (call.full_transcript) {
      children.push(
        new Paragraph({
          text: 'Transcript',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
      children.push(
        new Paragraph({
          text: call.full_transcript,
          spacing: { after: 200 },
        })
      );
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = calls.length === 1
    ? `${calls[0].title.replace(/[^a-z0-9]/gi, '_')}.docx`
    : `transcripts_${new Date().toISOString().split('T')[0]}.docx`;

  saveAs(blob, fileName);
}

export async function exportToTXT(calls: Call[]) {
  let content = '';

  calls.forEach((call, index) => {
    if (index > 0) {
      content += '\n\n' + '='.repeat(80) + '\n\n';
    }

    content += `${call.title}\n`;
    content += `Date: ${new Date(call.created_at).toLocaleDateString()}\n`;
    if (call.recorded_by_name) {
      content += `Recorded by: ${call.recorded_by_name}\n`;
    }
    content += '\n';

    if (call.summary) {
      content += 'SUMMARY\n';
      content += '-'.repeat(80) + '\n';
      content += `${call.summary}\n\n`;
    }

    if (call.full_transcript) {
      content += 'TRANSCRIPT\n';
      content += '-'.repeat(80) + '\n';
      content += `${call.full_transcript}\n`;
    }
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const fileName = calls.length === 1
    ? `${calls[0].title.replace(/[^a-z0-9]/gi, '_')}.txt`
    : `transcripts_${new Date().toISOString().split('T')[0]}.txt`;

  saveAs(blob, fileName);
}

export async function exportToJSON(calls: Call[]) {
  const exportData = calls.map(call => ({
    id: call.recording_id,
    title: call.title,
    date: call.created_at,
    recordedBy: {
      name: call.recorded_by_name,
      email: call.recorded_by_email,
    },
    summary: call.summary,
    transcript: call.full_transcript,
    duration: call.recording_start_time && call.recording_end_time
      ? new Date(call.recording_end_time).getTime() - new Date(call.recording_start_time).getTime()
      : null,
    url: call.url,
  }));

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });
  const fileName = calls.length === 1
    ? `${calls[0].title.replace(/[^a-z0-9]/gi, '_')}.json`
    : `transcripts_${new Date().toISOString().split('T')[0]}.json`;

  saveAs(blob, fileName);
}

export async function exportToZIP(calls: Call[]) {
  const zip = new JSZip();

  // Add each transcript as a separate text file
  calls.forEach((call, index) => {
    let content = `${call.title}\n`;
    content += `Date: ${new Date(call.created_at).toLocaleDateString()}\n`;
    if (call.recorded_by_name) {
      content += `Recorded by: ${call.recorded_by_name}\n`;
    }
    content += '\n';

    if (call.summary) {
      content += 'SUMMARY\n';
      content += '-'.repeat(80) + '\n';
      content += `${call.summary}\n\n`;
    }

    if (call.full_transcript) {
      content += 'TRANSCRIPT\n';
      content += '-'.repeat(80) + '\n';
      content += `${call.full_transcript}\n`;
    }

    const fileName = `${String(index + 1).padStart(3, '0')}_${call.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
    zip.file(fileName, content);
  });

  // Add a manifest JSON file
  const manifest = {
    exported: new Date().toISOString(),
    count: calls.length,
    transcripts: calls.map(call => ({
      id: call.recording_id,
      title: call.title,
      date: call.created_at,
    })),
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `transcripts_${new Date().toISOString().split('T')[0]}.zip`);
}

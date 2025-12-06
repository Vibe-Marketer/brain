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

interface _TranscriptSegment {
  speaker_name?: string;
  speaker_email?: string;
  text: string;
  timestamp?: string;
}

interface CalendarInvitee {
  name?: string;
  email?: string;
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

// Helper: Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Helper: Format date short (for filenames)
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

// Helper: Get week number and year
function getWeekInfo(dateStr: string): { week: number; year: number; weekStart: Date; weekEnd: Date } {
  const date = new Date(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);

  // Calculate week start (Sunday) and end (Saturday)
  const dayOfWeek = date.getDay();
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { week, year: date.getFullYear(), weekStart, weekEnd };
}

// Helper: Calculate duration in minutes
function calculateDurationMinutes(call: Call): number | null {
  if (call.recording_start_time && call.recording_end_time) {
    return Math.round(
      (new Date(call.recording_end_time).getTime() - new Date(call.recording_start_time).getTime()) / (1000 * 60)
    );
  }
  return null;
}

// Helper: Get participant names from call
function getParticipantNames(call: Call & { calendar_invitees?: CalendarInvitee[] }): string[] {
  const participants: string[] = [];
  if (call.recorded_by_name) {
    participants.push(call.recorded_by_name);
  }
  if (call.calendar_invitees && Array.isArray(call.calendar_invitees)) {
    call.calendar_invitees.forEach((inv: CalendarInvitee) => {
      if (inv?.name && !participants.includes(inv.name)) {
        participants.push(inv.name);
      }
    });
  }
  return participants;
}

// Convert transcript to clean markdown format
function transcriptToMarkdown(transcript: string): string {
  if (!transcript) return '';

  const lines = transcript.split('\n').filter(line => line.trim());
  let markdown = '';
  let currentSpeaker = '';
  let currentText: string[] = [];

  for (const line of lines) {
    // Match: [HH:MM:SS] Speaker Name (email): text
    const match = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s+([^(:]+?)(?:\s*\([^)]+\))?\s*:\s*(.*)$/);

    if (match) {
      const [, _timestamp, speaker, text] = match;
      const cleanSpeaker = speaker.split('|')[0].trim();

      if (cleanSpeaker !== currentSpeaker) {
        // Output previous speaker's text
        if (currentSpeaker && currentText.length > 0) {
          markdown += `**${currentSpeaker}:** ${currentText.join(' ')}\n\n`;
        }
        currentSpeaker = cleanSpeaker;
        currentText = [text.trim()];
      } else {
        currentText.push(text.trim());
      }
    }
  }

  // Output final speaker
  if (currentSpeaker && currentText.length > 0) {
    markdown += `**${currentSpeaker}:** ${currentText.join(' ')}\n\n`;
  }

  return markdown;
}

// Generate markdown content for a single call
function generateMarkdownContent(call: Call, includeYamlFrontmatter: boolean = true): string {
  let content = '';

  // YAML frontmatter (for Obsidian/Notion compatibility)
  if (includeYamlFrontmatter) {
    const duration = calculateDurationMinutes(call);
    const participants = getParticipantNames(call);

    content += '---\n';
    content += `title: "${call.title.replace(/"/g, '\\"')}"\n`;
    content += `date: ${formatDateShort(call.created_at)}\n`;
    content += `type: meeting\n`;
    if (call.recorded_by_name) {
      content += `host: "${call.recorded_by_name}"\n`;
    }
    if (participants.length > 0) {
      content += `participants:\n`;
      participants.forEach(p => {
        content += `  - "${p}"\n`;
      });
    }
    if (duration) {
      content += `duration: ${duration}\n`;
    }
    if (call.url) {
      content += `recording_url: "${call.url}"\n`;
    }
    content += '---\n\n';
  }

  // Title
  content += `# ${call.title}\n\n`;

  // Metadata section
  content += `📅 **Date:** ${formatDate(call.created_at)}\n`;
  if (call.recorded_by_name) {
    content += `👤 **Host:** ${call.recorded_by_name}\n`;
  }
  const duration = calculateDurationMinutes(call);
  if (duration) {
    content += `⏱️ **Duration:** ${duration} minutes\n`;
  }
  const participants = getParticipantNames(call);
  if (participants.length > 0) {
    content += `👥 **Participants:** ${participants.join(', ')}\n`;
  }
  if (call.url) {
    content += `🔗 **Recording:** [View Recording](${call.url})\n`;
  }
  content += '\n---\n\n';

  // Summary
  if (call.summary) {
    content += `## Summary\n\n${call.summary}\n\n`;
  }

  // Transcript
  if (call.full_transcript) {
    content += `## Transcript\n\n`;
    content += transcriptToMarkdown(call.full_transcript);
  }

  return content;
}

// Export to Markdown (single file or ZIP of individual files)
export async function exportToMarkdown(calls: Call[], asZip: boolean = false) {
  if (asZip || calls.length > 1) {
    const zip = new JSZip();

    calls.forEach((call, index) => {
      const content = generateMarkdownContent(call);
      const fileName = `${String(index + 1).padStart(3, '0')}_${call.title.replace(/[^a-z0-9]/gi, '_')}.md`;
      zip.file(fileName, content);
    });

    // Add index file
    let indexContent = `# Meeting Transcripts\n\n`;
    indexContent += `Exported: ${new Date().toLocaleString()}\n\n`;
    indexContent += `## Meetings (${calls.length})\n\n`;

    const sortedCalls = [...calls].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    sortedCalls.forEach((call) => {
      const fileName = `${String(calls.indexOf(call) + 1).padStart(3, '0')}_${call.title.replace(/[^a-z0-9]/gi, '_')}.md`;
      indexContent += `- [[${fileName}|${call.title}]] - ${formatDateShort(call.created_at)}\n`;
    });

    zip.file('_index.md', indexContent);

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `transcripts_${new Date().toISOString().split('T')[0]}.zip`);
  } else {
    // Single file
    const content = generateMarkdownContent(calls[0]);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const fileName = `${calls[0].title.replace(/[^a-z0-9]/gi, '_')}.md`;
    saveAs(blob, fileName);
  }
}

// Export to CSV (flat table for spreadsheet analysis)
export async function exportToCSV(calls: Call[]) {
  const headers = [
    'ID',
    'Title',
    'Date',
    'Day of Week',
    'Time',
    'Duration (min)',
    'Host',
    'Participant Count',
    'Participants',
    'Has Summary',
    'Has Transcript',
    'Summary Length',
    'Transcript Length',
    'Recording URL'
  ];

  const rows = calls.map(call => {
    const date = new Date(call.created_at);
    const duration = calculateDurationMinutes(call);
    const participants = getParticipantNames(call);

    return [
      call.recording_id,
      `"${call.title.replace(/"/g, '""')}"`,
      formatDateShort(call.created_at),
      date.toLocaleDateString('en-US', { weekday: 'long' }),
      date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      duration || '',
      call.recorded_by_name ? `"${call.recorded_by_name.replace(/"/g, '""')}"` : '',
      participants.length,
      `"${participants.join('; ').replace(/"/g, '""')}"`,
      call.summary ? 'Yes' : 'No',
      call.full_transcript ? 'Yes' : 'No',
      call.summary?.length || 0,
      call.full_transcript?.length || 0,
      call.url || ''
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `transcripts_${new Date().toISOString().split('T')[0]}.csv`);
}

// Export by Week (ZIP with weekly subfolders)
export async function exportByWeek(calls: Call[], format: 'md' | 'txt' = 'md') {
  const zip = new JSZip();

  // Sort calls chronologically
  const sortedCalls = [...calls].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Group by week
  const weekGroups = new Map<string, Call[]>();

  sortedCalls.forEach(call => {
    const { week, year, weekStart: _weekStart, weekEnd: _weekEnd } = getWeekInfo(call.created_at);
    const weekKey = `${year}-W${String(week).padStart(2, '0')}`;
    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, []);
    }
    weekGroups.get(weekKey)!.push(call);
  });

  // Create folder for each week
  let weekIndex = 0;
  for (const [_weekKey, weekCalls] of weekGroups) {
    weekIndex++;
    const { weekStart, weekEnd } = getWeekInfo(weekCalls[0].created_at);
    const folderName = `Week_${weekIndex}_${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(/\s/g, '')}-${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(/\s/g, '')}`;

    // Add each call to the week folder
    weekCalls.forEach((call, callIndex) => {
      let content: string;
      let fileName: string;

      if (format === 'md') {
        content = generateMarkdownContent(call);
        fileName = `${folderName}/${String(callIndex + 1).padStart(2, '0')}_${call.title.replace(/[^a-z0-9]/gi, '_')}.md`;
      } else {
        content = `${call.title}\n`;
        content += `Date: ${formatDate(call.created_at)}\n`;
        if (call.recorded_by_name) {
          content += `Recorded by: ${call.recorded_by_name}\n`;
        }
        content += '\n';
        if (call.summary) {
          content += 'SUMMARY\n' + '-'.repeat(80) + '\n' + call.summary + '\n\n';
        }
        if (call.full_transcript) {
          content += 'TRANSCRIPT\n' + '-'.repeat(80) + '\n' + call.full_transcript + '\n';
        }
        fileName = `${folderName}/${String(callIndex + 1).padStart(2, '0')}_${call.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
      }

      zip.file(fileName, content);
    });

    // Add week summary file
    let weekSummary = format === 'md'
      ? `# Week ${weekIndex}: ${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n\n`
      : `WEEK ${weekIndex}: ${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n${'='.repeat(80)}\n\n`;

    weekSummary += `Total Meetings: ${weekCalls.length}\n\n`;

    if (format === 'md') {
      weekSummary += `## Meetings\n\n`;
      weekCalls.forEach((call, i) => {
        const duration = calculateDurationMinutes(call);
        weekSummary += `${i + 1}. **${call.title}**\n`;
        weekSummary += `   - Date: ${formatDate(call.created_at)}\n`;
        if (duration) weekSummary += `   - Duration: ${duration} min\n`;
        weekSummary += '\n';
      });
    } else {
      weekSummary += `MEETINGS\n${'-'.repeat(80)}\n\n`;
      weekCalls.forEach((call, i) => {
        const duration = calculateDurationMinutes(call);
        weekSummary += `${i + 1}. ${call.title}\n`;
        weekSummary += `   Date: ${formatDate(call.created_at)}\n`;
        if (duration) weekSummary += `   Duration: ${duration} min\n`;
        weekSummary += '\n';
      });
    }

    zip.file(`${folderName}/_week_summary.${format}`, weekSummary);
  }

  // Add master index
  let masterIndex = format === 'md'
    ? `# Meeting Export by Week\n\nExported: ${new Date().toLocaleString()}\n\n## Summary\n\n- **Total Meetings:** ${calls.length}\n- **Weeks Covered:** ${weekGroups.size}\n\n## Weeks\n\n`
    : `MEETING EXPORT BY WEEK\n${'='.repeat(80)}\n\nExported: ${new Date().toLocaleString()}\n\nSUMMARY\n- Total Meetings: ${calls.length}\n- Weeks Covered: ${weekGroups.size}\n\nWEEKS\n${'-'.repeat(80)}\n\n`;

  weekIndex = 0;
  for (const [, weekCalls] of weekGroups) {
    weekIndex++;
    const { weekStart, weekEnd } = getWeekInfo(weekCalls[0].created_at);
    masterIndex += format === 'md'
      ? `- **Week ${weekIndex}:** ${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} (${weekCalls.length} meetings)\n`
      : `Week ${weekIndex}: ${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} (${weekCalls.length} meetings)\n`;
  }

  zip.file(`_index.${format}`, masterIndex);

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `transcripts_by_week_${new Date().toISOString().split('T')[0]}.zip`);
}

// Export by Folder (respects folder structure)
export async function exportByFolder(
  calls: Call[],
  folderAssignments: Record<string, string[]>,
  folders: Array<{ id: string; name: string; color: string }>,
  format: 'md' | 'txt' = 'md'
) {
  const zip = new JSZip();

  // Group calls by folder
  const folderGroups = new Map<string, Call[]>();
  const unassignedCalls: Call[] = [];

  calls.forEach(call => {
    const callFolders = folderAssignments[call.recording_id] || [];
    if (callFolders.length === 0) {
      unassignedCalls.push(call);
    } else {
      // Add to first assigned folder (primary folder)
      const folderId = callFolders[0];
      if (!folderGroups.has(folderId)) {
        folderGroups.set(folderId, []);
      }
      folderGroups.get(folderId)!.push(call);
    }
  });

  // Create folder for each folder group
  for (const [folderId, folderCalls] of folderGroups) {
    const folder = folders.find(f => f.id === folderId);
    const folderName = folder?.name.replace(/[^a-z0-9]/gi, '_') || `Folder_${folderId.slice(0, 8)}`;

    folderCalls.forEach((call, index) => {
      let content: string;
      let fileName: string;

      if (format === 'md') {
        content = generateMarkdownContent(call);
        fileName = `${folderName}/${String(index + 1).padStart(2, '0')}_${call.title.replace(/[^a-z0-9]/gi, '_')}.md`;
      } else {
        content = `${call.title}\n`;
        content += `Date: ${formatDate(call.created_at)}\n`;
        if (call.recorded_by_name) content += `Recorded by: ${call.recorded_by_name}\n`;
        content += '\n';
        if (call.summary) content += 'SUMMARY\n' + '-'.repeat(80) + '\n' + call.summary + '\n\n';
        if (call.full_transcript) content += 'TRANSCRIPT\n' + '-'.repeat(80) + '\n' + call.full_transcript + '\n';
        fileName = `${folderName}/${String(index + 1).padStart(2, '0')}_${call.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
      }

      zip.file(fileName, content);
    });
  }

  // Handle unassigned calls
  if (unassignedCalls.length > 0) {
    unassignedCalls.forEach((call, index) => {
      let content: string;
      let fileName: string;

      if (format === 'md') {
        content = generateMarkdownContent(call);
        fileName = `_Unassigned/${String(index + 1).padStart(2, '0')}_${call.title.replace(/[^a-z0-9]/gi, '_')}.md`;
      } else {
        content = `${call.title}\nDate: ${formatDate(call.created_at)}\n`;
        if (call.recorded_by_name) content += `Recorded by: ${call.recorded_by_name}\n`;
        content += '\n';
        if (call.summary) content += 'SUMMARY\n' + '-'.repeat(80) + '\n' + call.summary + '\n\n';
        if (call.full_transcript) content += 'TRANSCRIPT\n' + '-'.repeat(80) + '\n' + call.full_transcript + '\n';
        fileName = `_Unassigned/${String(index + 1).padStart(2, '0')}_${call.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
      }

      zip.file(fileName, content);
    });
  }

  // Add index file
  let indexContent = format === 'md'
    ? `# Meeting Export by Folder\n\nExported: ${new Date().toLocaleString()}\n\n## Summary\n\n- **Total Meetings:** ${calls.length}\n- **Folders:** ${folderGroups.size}\n\n## Folders\n\n`
    : `MEETING EXPORT BY FOLDER\n${'='.repeat(80)}\n\nExported: ${new Date().toLocaleString()}\n\nTotal Meetings: ${calls.length}\nFolders: ${folderGroups.size}\n\n`;

  for (const [folderId, folderCalls] of folderGroups) {
    const folder = folders.find(f => f.id === folderId);
    indexContent += format === 'md'
      ? `- **${folder?.name || 'Unknown'}:** ${folderCalls.length} meetings\n`
      : `${folder?.name || 'Unknown'}: ${folderCalls.length} meetings\n`;
  }

  if (unassignedCalls.length > 0) {
    indexContent += format === 'md'
      ? `- **Unassigned:** ${unassignedCalls.length} meetings\n`
      : `Unassigned: ${unassignedCalls.length} meetings\n`;
  }

  zip.file(`_index.${format}`, indexContent);

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `transcripts_by_folder_${new Date().toISOString().split('T')[0]}.zip`);
}

// Export by Tag
export async function exportByTag(
  calls: Call[],
  tagAssignments: Record<string, string[]>,
  tags: Array<{ id: string; name: string }>,
  format: 'md' | 'txt' = 'md'
) {
  const zip = new JSZip();

  // Group calls by tag
  const tagGroups = new Map<string, Call[]>();
  const untaggedCalls: Call[] = [];

  calls.forEach(call => {
    const callTags = tagAssignments[call.recording_id] || [];
    if (callTags.length === 0) {
      untaggedCalls.push(call);
    } else {
      // Add to first tag (primary tag)
      const tagId = callTags[0];
      if (!tagGroups.has(tagId)) {
        tagGroups.set(tagId, []);
      }
      tagGroups.get(tagId)!.push(call);
    }
  });

  // Create folder for each tag
  for (const [tagId, tagCalls] of tagGroups) {
    const tag = tags.find(t => t.id === tagId);
    const tagFolder = tag?.name.replace(/[^a-z0-9]/gi, '_') || `Tag_${tagId.slice(0, 8)}`;

    tagCalls.forEach((call, index) => {
      const content = format === 'md'
        ? generateMarkdownContent(call)
        : `${call.title}\nDate: ${formatDate(call.created_at)}\n${call.recorded_by_name ? `Recorded by: ${call.recorded_by_name}\n` : ''}\n${call.summary ? 'SUMMARY\n' + '-'.repeat(80) + '\n' + call.summary + '\n\n' : ''}${call.full_transcript ? 'TRANSCRIPT\n' + '-'.repeat(80) + '\n' + call.full_transcript + '\n' : ''}`;

      const fileName = `${tagFolder}/${String(index + 1).padStart(2, '0')}_${call.title.replace(/[^a-z0-9]/gi, '_')}.${format}`;
      zip.file(fileName, content);
    });
  }

  // Handle untagged calls
  if (untaggedCalls.length > 0) {
    untaggedCalls.forEach((call, index) => {
      const content = format === 'md'
        ? generateMarkdownContent(call)
        : `${call.title}\nDate: ${formatDate(call.created_at)}\n${call.recorded_by_name ? `Recorded by: ${call.recorded_by_name}\n` : ''}\n${call.summary ? 'SUMMARY\n' + '-'.repeat(80) + '\n' + call.summary + '\n\n' : ''}${call.full_transcript ? 'TRANSCRIPT\n' + '-'.repeat(80) + '\n' + call.full_transcript + '\n' : ''}`;

      const fileName = `_Untagged/${String(index + 1).padStart(2, '0')}_${call.title.replace(/[^a-z0-9]/gi, '_')}.${format}`;
      zip.file(fileName, content);
    });
  }

  // Add index file
  let indexContent = format === 'md'
    ? `# Meeting Export by Tag\n\nExported: ${new Date().toLocaleString()}\n\n## Summary\n\n- **Total Meetings:** ${calls.length}\n- **Tags:** ${tagGroups.size}\n\n## Tags\n\n`
    : `MEETING EXPORT BY TAG\n${'='.repeat(80)}\n\nExported: ${new Date().toLocaleString()}\n\nTotal Meetings: ${calls.length}\nTags: ${tagGroups.size}\n\n`;

  for (const [tagId, tagCalls] of tagGroups) {
    const tag = tags.find(t => t.id === tagId);
    indexContent += format === 'md'
      ? `- **${tag?.name || 'Unknown'}:** ${tagCalls.length} meetings\n`
      : `${tag?.name || 'Unknown'}: ${tagCalls.length} meetings\n`;
  }

  if (untaggedCalls.length > 0) {
    indexContent += format === 'md'
      ? `- **Untagged:** ${untaggedCalls.length} meetings\n`
      : `Untagged: ${untaggedCalls.length} meetings\n`;
  }

  zip.file(`_index.${format}`, indexContent);

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `transcripts_by_tag_${new Date().toISOString().split('T')[0]}.zip`);
}

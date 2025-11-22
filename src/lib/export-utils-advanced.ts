import { saveAs } from "file-saver";

// Token estimation (rough approximation: ~4 chars per token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Format date for Fathom-style header (e.g., "November 11")
function formatDateFathom(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  });
}

// Convert [HH:MM:SS] timestamp to smart digit format
function formatTimestampSmart(timestamp: string): string {
  // Remove brackets if present
  const cleaned = timestamp.replace(/[\[\]]/g, '');
  const parts = cleaned.split(':');
  
  if (parts.length !== 3) return timestamp;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  
  // Under 1 minute: :SS
  if (hours === 0 && minutes === 0) {
    return `:${seconds.toString().padStart(2, '0')}`;
  }
  
  // 1-59 minutes: M:SS or MM:SS
  if (hours === 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Over 1 hour: H:MM:SS or HH:MM:SS
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Reformat transcript to Fathom style (consolidated speaker turns, smart timestamps, no emails)
function reformatTranscriptToFathom(transcript: string, includeTimestamps: boolean = true): string {
  if (!transcript) return '';
  
  const lines = transcript.split('\n').filter(line => line.trim());
  
  // Parse all segments first
  interface Segment {
    timestamp: string;
    speaker: string;
    text: string;
  }
  
  const segments: Segment[] = [];
  
  for (const line of lines) {
    // Match pattern: [HH:MM:SS] Speaker Name: text
    const match = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s*(.*)$/);
    
    if (match) {
      const [, timestamp, speakerFull, text] = match;
      
      // Remove email from speaker name (e.g., "Name (email@domain.com)" -> "Name")
      const speaker = speakerFull.split('(')[0].trim();
      
      // Remove suffixes like "| Company" from speaker name
      const cleanSpeaker = speaker.split('|')[0].trim();
      
      segments.push({
        timestamp: formatTimestampSmart(timestamp),
        speaker: cleanSpeaker,
        text: text.trim()
      });
    }
  }
  
  // Consolidate consecutive turns from the same speaker
  let formatted = '';
  let currentSpeaker = '';
  let currentTimestamp = '';
  let accumulatedText: string[] = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    if (segment.speaker !== currentSpeaker) {
      // Output the previous speaker's accumulated text
      if (currentSpeaker && accumulatedText.length > 0) {
        if (includeTimestamps) {
          formatted += `${currentTimestamp} - ${currentSpeaker}\n`;
        } else {
          formatted += `${currentSpeaker}\n`;
        }
        formatted += `  ${accumulatedText.join(' ')}\n\n`;
      }
      
      // Start new speaker
      currentSpeaker = segment.speaker;
      currentTimestamp = segment.timestamp;
      accumulatedText = [segment.text];
    } else {
      // Same speaker, accumulate text
      accumulatedText.push(segment.text);
    }
  }
  
  // Output the final speaker's accumulated text
  if (currentSpeaker && accumulatedText.length > 0) {
    if (includeTimestamps) {
      formatted += `${currentTimestamp} - ${currentSpeaker}\n`;
    } else {
      formatted += `${currentSpeaker}\n`;
    }
    formatted += `  ${accumulatedText.join(' ')}\n\n`;
  }
  
  return formatted.trim();
}

// Calculate duration between two timestamps
function calculateDuration(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const minutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
  return `${minutes} min`;
}

interface Call {
  recording_id: number;
  title: string;
  created_at: string;
  recording_start_time?: string;
  recording_end_time?: string;
  summary?: string;
  full_transcript?: string;
  url?: string;
  calendar_invitees?: any[];
  recorded_by_name?: string;
  recorded_by_email?: string;
}

// Helper: Extract unique speakers from transcript
function extractSpeakersFromTranscript(transcript: string): { name: string; email?: string }[] {
  const speakerMap = new Map<string, { name: string; email?: string }>();
  const lines = transcript.split('\n');
  
  for (const line of lines) {
    // Match format: [HH:MM:SS] Speaker Name (email@domain.com): or [HH:MM:SS] Speaker Name:
    const match = line.match(/^\[[\d:]+\]\s+([^(:]+?)(?:\s*\(([^)]+)\))?\s*:/);
    if (match) {
      const name = match[1].trim();
      const email = match[2]?.trim();
      if (!speakerMap.has(name)) {
        speakerMap.set(name, { name, email });
      }
    }
  }
  
  return Array.from(speakerMap.values());
}

// Helper: Strip URLs from summary
function stripUrlsFromSummary(summary: string, keepUrls: boolean): string {
  if (keepUrls) return summary;
  // Remove markdown links: [text](url) -> text
  return summary.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

// Export as LLM Context Bundle (chronological, optimized for AI analysis)
export function exportAsLLMContext(calls: Call[], includeOptions?: { metadata?: boolean; transcripts?: boolean; summaries?: boolean; participants?: boolean }): void {
  // Sort chronologically
  const sortedCalls = [...calls].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let content = '';

  // Add each meeting in Fathom format
  sortedCalls.forEach((call, index) => {
    if (index > 0) content += '\n\n';
    
    // Fathom-style header: "Title - Month Day"
    content += `${call.title} - ${formatDateFathom(call.created_at)}\n`;
    
    // Duration and URL line
    if (call.recording_start_time && call.recording_end_time) {
      const minutes = Math.round((new Date(call.recording_end_time).getTime() - new Date(call.recording_start_time).getTime()) / (1000 * 60));
      content += `VIEW RECORDING - ${minutes} mins`;
      if (includeOptions?.metadata !== false && call.url) {
        content += `: ${call.url}`;
      }
      content += '\n';
    }
    
    content += '\n---\n\n';

    // Add participants if included
    if (includeOptions?.participants !== false) {
      // Extract actual speakers from transcript
      const speakers = call.full_transcript ? extractSpeakersFromTranscript(call.full_transcript) : [];
      
      if (call.recorded_by_name) {
        content += `Host: ${call.recorded_by_name}`;
        if (includeOptions?.metadata !== false && call.recorded_by_email) {
          content += ` (${call.recorded_by_email})`;
        }
        content += '\n';
      }
      
      if (speakers.length > 0) {
        content += `Speakers: ${speakers.map(speaker => {
          if (includeOptions?.metadata !== false && speaker.email) {
            return `${speaker.name} (${speaker.email})`;
          }
          return speaker.name;
        }).join(', ')}\n`;
      } else if (call.calendar_invitees && call.calendar_invitees.length > 0) {
        // Fallback to invitees if no speakers found
        content += `Invitees: ${call.calendar_invitees.map(inv => {
          if (includeOptions?.metadata !== false && inv.email) {
            return `${inv.name} (${inv.email})`;
          }
          return inv.name;
        }).join(', ')}\n`;
      }
      content += '\n';
    }

    // Add summary if included and available
    if (includeOptions?.summaries !== false && call.summary) {
      const cleanSummary = stripUrlsFromSummary(call.summary, includeOptions?.metadata !== false);
      content += `Summary:\n${cleanSummary}\n\n`;
    }

    // Add transcript if included and available
    if (includeOptions?.transcripts !== false && call.full_transcript) {
      const formattedTranscript = reformatTranscriptToFathom(call.full_transcript, includeOptions?.metadata !== false);
      content += formattedTranscript;
    }
  });

  // Save file
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const filename = `fathom-export-${sortedCalls.length}-meetings-${new Date().toISOString().split('T')[0]}.txt`;
  saveAs(blob, filename);
}

// Export as Chronological Narrative (human-readable, Fathom-style)
export function exportAsNarrative(calls: Call[]): void {
  const sortedCalls = [...calls].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let content = '';

  sortedCalls.forEach((call, index) => {
    if (index > 0) content += '\n\n';
    
    // Fathom-style header
    content += `${call.title} - ${formatDateFathom(call.created_at)}\n`;
    
    if (call.recording_start_time && call.recording_end_time) {
      const minutes = Math.round((new Date(call.recording_end_time).getTime() - new Date(call.recording_start_time).getTime()) / (1000 * 60));
      content += `VIEW RECORDING - ${minutes} mins`;
      if (call.url) {
        content += `: ${call.url}`;
      }
      content += '\n';
    }
    
    content += '\n---\n\n';

    if (call.full_transcript) {
      const formattedTranscript = reformatTranscriptToFathom(call.full_transcript);
      content += formattedTranscript;
    }
  });

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const filename = `narrative-${sortedCalls.length}-meetings-${new Date().toISOString().split('T')[0]}.txt`;
  saveAs(blob, filename);
}

// Export as structured JSON for data analysis
export function exportAsAnalysisPackage(calls: Call[]): void {
  const sortedCalls = [...calls].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const exportData = {
    export_metadata: {
      generated_at: new Date().toISOString(),
      total_meetings: sortedCalls.length,
      date_range: {
        start: sortedCalls[0].created_at,
        end: sortedCalls[sortedCalls.length - 1].created_at
      },
      format_version: "1.0"
    },
    meetings: sortedCalls.map(call => ({
      id: call.recording_id,
      title: call.title,
      date: call.created_at,
      recording_start_time: call.recording_start_time,
      recording_end_time: call.recording_end_time,
      duration_minutes: call.recording_start_time && call.recording_end_time
        ? Math.round((new Date(call.recording_end_time).getTime() - new Date(call.recording_start_time).getTime()) / (1000 * 60))
        : null,
      host: call.recorded_by_name,
      participants: call.calendar_invitees?.map(inv => inv.name) || [],
      summary: call.summary,
      transcript: call.full_transcript,
      url: call.url,
      metrics: {
        transcript_length: call.full_transcript?.length || 0,
        estimated_tokens: call.full_transcript ? estimateTokens(call.full_transcript) : 0,
        has_summary: !!call.summary,
        participant_count: (call.calendar_invitees?.length || 0) + (call.recorded_by_name ? 1 : 0)
      }
    }))
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
  const filename = `analysis-package-${sortedCalls.length}-meetings-${new Date().toISOString().split('T')[0]}.json`;
  saveAs(blob, filename);
}

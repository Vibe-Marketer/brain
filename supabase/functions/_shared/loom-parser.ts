export interface LoomSegment {
  start_ms: number;
  speaker: string;
  text: string;
}

export function isLoomUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /loom\.com\/share\//i.test(url);
}

export function extractLoomShareToken(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/loom\.com\/share\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

export function parseLoomTranscript(rawText: string) {
  if (!rawText) return { parse_status: 'raw', segments: [] };
  
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n');
  const segments: LoomSegment[] = [];
  let current: LoomSegment | null = null;
  
  const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const timeMatch = line.match(TIME_RE);
    if (timeMatch) {
      if (current) segments.push(current);
      
      let s = 0;
      if (timeMatch[3] !== undefined) {
        // H:MM:SS
        s = (parseInt(timeMatch[1], 10) * 3600) + (parseInt(timeMatch[2], 10) * 60) + parseInt(timeMatch[3], 10);
      } else {
        // MM:SS
        s = (parseInt(timeMatch[1], 10) * 60) + parseInt(timeMatch[2], 10);
      }
      
      current = {
        start_ms: s * 1000,
        speaker: 'Unknown Speaker',
        text: ''
      };
    } else if (current) {
      current.text = current.text ? `${current.text} ${line}` : line;
    }
  }
  
  if (current && current.text) segments.push(current);
  
  if (segments.length > 0) {
    return { parse_status: 'parsed', segments };
  }
  return { parse_status: 'raw', segments: [] };
}

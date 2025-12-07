/**
 * Debug Dump Utilities
 *
 * Helper functions for creating enhanced, Claude-Code-friendly debug dumps.
 */

import type { DebugMessage } from './types';

// Parse user agent into readable format
export function parseUserAgent(ua: string): { browser: string; os: string } {
  let browser = 'Unknown';
  let os = 'Unknown';

  // Detect OS
  if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // Detect Browser
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    const match = ua.match(/Chrome\/([\d.]+)/);
    browser = match ? `Chrome ${match[1]}` : 'Chrome';
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/([\d.]+)/);
    browser = match ? `Safari ${match[1]}` : 'Safari';
  } else if (ua.includes('Firefox')) {
    const match = ua.match(/Firefox\/([\d.]+)/);
    browser = match ? `Firefox ${match[1]}` : 'Firefox';
  } else if (ua.includes('Edg')) {
    const match = ua.match(/Edg\/([\d.]+)/);
    browser = match ? `Edge ${match[1]}` : 'Edge';
  }

  return { browser, os };
}

// Group duplicate errors and count occurrences
export interface ErrorGroup {
  type: DebugMessage['type'];
  message: string;
  category?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sources: string[];
  details?: string[];
}

export function groupErrors(messages: DebugMessage[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();

  for (const msg of messages) {
    const key = `${msg.type}:${msg.message}`;
    const existing = groups.get(key);
    const timestamp = new Date(msg.timestamp).toISOString();

    if (existing) {
      existing.count++;
      existing.lastSeen = timestamp;
      if (msg.source && !existing.sources.includes(msg.source)) {
        existing.sources.push(msg.source);
      }
      if (msg.details && existing.details && !existing.details.includes(msg.details)) {
        existing.details.push(msg.details);
      }
    } else {
      groups.set(key, {
        type: msg.type,
        message: msg.message,
        category: msg.category,
        count: 1,
        firstSeen: timestamp,
        lastSeen: timestamp,
        sources: msg.source ? [msg.source] : [],
        details: msg.details ? [msg.details] : undefined,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

// Calculate time span between first and last message
export function calculateTimeSpan(messages: DebugMessage[]): string {
  if (messages.length < 2) return '0 seconds';

  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const diffMs = sorted[sorted.length - 1].timestamp - sorted[0].timestamp;

  if (diffMs < 1000) return `${diffMs}ms`;
  if (diffMs < 60000) return `${Math.round(diffMs / 1000)} seconds`;
  if (diffMs < 3600000) return `${Math.round(diffMs / 60000)} minutes`;
  return `${Math.round(diffMs / 3600000)} hours`;
}

// Parse stack trace into file:line format
export interface ParsedStackFrame {
  function: string;
  file: string;
  line: number;
  column: number;
}

export function parseStackTrace(stack: string | undefined): ParsedStackFrame[] {
  if (!stack) return [];

  const frames: ParsedStackFrame[] = [];
  const lines = stack.split('\n');

  for (const line of lines) {
    // Match patterns like "at functionName (file.ts:123:45)" or "at file.ts:123:45"
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
    if (match) {
      let file = match[2];
      // Clean up webpack/vite paths
      const srcMatch = file.match(/src\/(.+)/);
      if (srcMatch) file = `src/${srcMatch[1]}`;

      frames.push({
        function: match[1] || '<anonymous>',
        file,
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10),
      });
    }
  }

  return frames.slice(0, 10); // Limit to 10 frames
}

// Generate summary for dump
export interface DumpSummary {
  totalMessages: number;
  errors: number;
  warnings: number;
  info: number;
  uniqueErrors: number;
  timeSpan: string;
  topIssue: string | null;
}

export function generateSummary(messages: DebugMessage[]): DumpSummary {
  const errors = messages.filter(m => m.type === 'error');
  const warnings = messages.filter(m => m.type === 'warning');
  const info = messages.filter(m => m.type === 'info');
  const groups = groupErrors(messages);
  const uniqueErrors = groups.filter(g => g.type === 'error').length;

  let topIssue: string | null = null;
  if (groups.length > 0) {
    const top = groups[0];
    topIssue = `${top.type}: ${top.message.slice(0, 50)}${top.message.length > 50 ? '...' : ''} (${top.count}x)`;
  }

  return {
    totalMessages: messages.length,
    errors: errors.length,
    warnings: warnings.length,
    info: info.length,
    uniqueErrors,
    timeSpan: calculateTimeSpan(messages),
    topIssue,
  };
}

// Format as Markdown for Claude Code
export function formatAsMarkdown(
  messages: DebugMessage[],
  appState: { url: string; userAgent: string; viewport: { width: number; height: number } }
): string {
  const summary = generateSummary(messages);
  const groups = groupErrors(messages);
  const { browser, os } = parseUserAgent(appState.userAgent);

  let md = `# 🐛 Debug Report\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n`;
  md += `**URL:** ${appState.url}\n`;
  md += `**Environment:** ${browser} on ${os} (${appState.viewport.width}x${appState.viewport.height})\n\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Messages | ${summary.totalMessages} |\n`;
  md += `| Errors | ${summary.errors} |\n`;
  md += `| Warnings | ${summary.warnings} |\n`;
  md += `| Unique Issues | ${summary.uniqueErrors} |\n`;
  md += `| Time Span | ${summary.timeSpan} |\n\n`;

  if (summary.topIssue) {
    md += `**Top Issue:** ${summary.topIssue}\n\n`;
  }

  md += `## Error Groups\n\n`;

  for (const group of groups) {
    const icon = group.type === 'error' ? '🔴' : group.type === 'warning' ? '🟡' : '🔵';
    md += `### ${icon} ${group.message}\n\n`;
    md += `- **Type:** ${group.type}\n`;
    md += `- **Count:** ${group.count}\n`;
    md += `- **Category:** ${group.category || 'unknown'}\n`;
    md += `- **First Seen:** ${group.firstSeen}\n`;
    if (group.count > 1) {
      md += `- **Last Seen:** ${group.lastSeen}\n`;
    }
    if (group.sources.length > 0) {
      md += `- **Sources:** ${group.sources.join(', ')}\n`;
    }
    if (group.details && group.details.length > 0) {
      md += `\n**Details:**\n\`\`\`\n${group.details.slice(0, 3).join('\n')}\n\`\`\`\n`;
    }
    md += `\n`;
  }

  return md;
}

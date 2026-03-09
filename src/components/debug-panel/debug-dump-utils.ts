/**
 * Debug Dump Utilities
 *
 * Helper functions for creating enhanced, Claude-Code-friendly debug dumps.
 */

import type { DebugMessage, ActionTrailEntry, Severity } from './types';

// ─── Root Cause Analysis ─────────────────────────────────────────────────────

export type RootCauseType =
  | 'schema_mismatch'
  | 'rls_block'
  | 'auth_failure'
  | 'n_plus_one'
  | 'network_timeout'
  | 'missing_table'
  | 'missing_relation'
  | 'type_mismatch'
  | 'unknown';

export interface RootCauseGroup {
  rootCause: RootCauseType;
  label: string;
  severity: Severity;
  description: string;
  suggestedFix: string;
  affectedMessages: DebugMessage[];
  /** URL patterns or table names involved */
  affectedEntities: string[];
}

/** Patterns that identify specific root causes from error messages / response bodies */
const ROOT_CAUSE_PATTERNS: Array<{
  rootCause: RootCauseType;
  label: string;
  severity: Severity;
  /** Matches against message + responseBody (lowercased) */
  patterns: RegExp[];
  descriptionTemplate: (msgs: DebugMessage[]) => string;
  fixTemplate: (msgs: DebugMessage[]) => string;
}> = [
  {
    rootCause: 'schema_mismatch',
    label: 'Schema Mismatch',
    severity: 'critical',
    patterns: [
      /column\s+"[^"]+"\s+does not exist/i,
      /column\s+\w+\s+of relation\s+\w+\s+does not exist/i,
    ],
    descriptionTemplate: (msgs) => {
      const columns = extractColumnNames(msgs);
      return `Frontend queries are referencing columns that don't exist in the database schema. Columns: ${columns.join(', ')}`;
    },
    fixTemplate: (msgs) => {
      const columns = extractColumnNames(msgs);
      return `Search your service/hook files for \`${columns.join('`, `')}\` and update the column name(s) to match the current DB schema. Run the migration if the column was renamed.`;
    },
  },
  {
    rootCause: 'missing_table',
    label: 'Missing Table / Relation',
    severity: 'critical',
    patterns: [
      /relation\s+"[^"]+"\s+does not exist/i,
      /table\s+"[^"]+"\s+does not exist/i,
    ],
    descriptionTemplate: (msgs) => {
      const tables = extractTableNames(msgs);
      return `Queries reference tables/views that don't exist: ${tables.join(', ')}`;
    },
    fixTemplate: (msgs) => {
      const tables = extractTableNames(msgs);
      return `Run a migration to create the table(s): ${tables.join(', ')}. Or check if the table was renamed — update the query accordingly.`;
    },
  },
  {
    rootCause: 'rls_block',
    label: 'RLS Policy Blocking Query',
    severity: 'high',
    patterns: [
      /new row violates row-level security/i,
      /permission denied for table/i,
      /insufficient_privilege/i,
    ],
    descriptionTemplate: (msgs) => {
      const tables = extractTablesFromUrls(msgs);
      return `Row-Level Security (RLS) policies are blocking queries${tables.length > 0 ? ` on: ${tables.join(', ')}` : ''}. The user may lack the required role or the policy condition isn't met.`;
    },
    fixTemplate: () =>
      `Check RLS policies in Supabase Dashboard → Authentication → Policies. Ensure the table has policies for the authenticated role. Common fix: add a permissive SELECT policy or verify the user's org_id/role in the JWT claims.`,
  },
  {
    rootCause: 'auth_failure',
    label: 'Authentication Failure',
    severity: 'critical',
    patterns: [
      /invalid jwt/i,
      /jwt expired/i,
      /\bHTTP 401\b/i,
      /not authenticated/i,
      /session.*expired/i,
    ],
    descriptionTemplate: () =>
      `Authentication tokens are invalid or expired. Users may be logged out or the session wasn't refreshed.`,
    fixTemplate: () =>
      `Verify Supabase session refresh logic. Ensure \`supabase.auth.onAuthStateChange\` is handled and tokens are refreshed before expiry. Check if PKCE flow is configured correctly for the OAuth provider.`,
  },
  {
    rootCause: 'n_plus_one',
    label: 'N+1 Query Pattern',
    severity: 'medium',
    patterns: [
      /\[N\+1 DETECTED\]/i,
    ],
    descriptionTemplate: (msgs) => {
      const urls = [...new Set(msgs.map(m => m.url).filter(Boolean))];
      return `The same API endpoint is being called individually for each item instead of in a single batch query. Affected endpoints: ${urls.slice(0, 3).join(', ')}`;
    },
    fixTemplate: () =>
      `Replace individual \`.eq('id', itemId)\` calls with \`.in('id', [id1, id2, ...])\` to batch the queries. Or use a join in the parent query to fetch related data in one request.`,
  },
  {
    rootCause: 'type_mismatch',
    label: 'Type / Operator Mismatch',
    severity: 'high',
    patterns: [
      /operator does not exist/i,
      /invalid input syntax for type/i,
      /cannot cast type/i,
    ],
    descriptionTemplate: () =>
      `PostgreSQL type mismatch — the query is comparing or casting incompatible types.`,
    fixTemplate: () =>
      `Check the column types in your schema and ensure query values match. Common issue: passing a string UUID where an integer is expected, or vice versa. Use explicit casts in the query if needed.`,
  },
  {
    rootCause: 'network_timeout',
    label: 'Slow / Timeout Requests',
    severity: 'medium',
    patterns: [
      /\[SLOW REQUEST\]/i,
      /network request failed/i,
      /fetcherror/i,
    ],
    descriptionTemplate: (msgs) => {
      const durations = msgs.map(m => m.duration).filter(Boolean) as number[];
      const avg = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
      return `${msgs.length} request(s) are timing out or running slowly (avg ${avg}ms). This may indicate missing database indexes or N+1 queries.`;
    },
    fixTemplate: () =>
      `Add database indexes for frequently filtered columns (e.g., \`org_id\`, \`user_id\`, \`created_at\`). Check for N+1 patterns — batch requests using \`.in()\` instead of per-item fetches.`,
  },
];

function extractColumnNames(msgs: DebugMessage[]): string[] {
  const columns = new Set<string>();
  for (const msg of msgs) {
    const text = `${msg.message} ${msg.details || ''} ${msg.responseBody || ''}`;
    const matches = text.matchAll(/column\s+"([^"]+)"/gi);
    for (const m of matches) columns.add(m[1]);
  }
  return [...columns];
}

function extractTableNames(msgs: DebugMessage[]): string[] {
  const tables = new Set<string>();
  for (const msg of msgs) {
    const text = `${msg.message} ${msg.details || ''} ${msg.responseBody || ''}`;
    const relMatches = text.matchAll(/relation\s+"([^"]+)"/gi);
    const tableMatches = text.matchAll(/table\s+"([^"]+)"/gi);
    for (const m of relMatches) tables.add(m[1]);
    for (const m of tableMatches) tables.add(m[1]);
  }
  return [...tables];
}

function extractTablesFromUrls(msgs: DebugMessage[]): string[] {
  const tables = new Set<string>();
  for (const msg of msgs) {
    if (!msg.url) continue;
    // Extract table name from Supabase REST URL: /rest/v1/table_name?...
    const match = msg.url.match(/\/rest\/v1\/([a-z_]+)/i);
    if (match) tables.add(match[1]);
  }
  return [...tables];
}

/**
 * Analyze a list of messages and group them by detected root cause.
 * Returns groups sorted by severity (critical first).
 */
export function detectRootCauseGroups(messages: DebugMessage[]): RootCauseGroup[] {
  const groups = new Map<RootCauseType, RootCauseGroup>();

  for (const msg of messages) {
    if (msg.type !== 'error' && msg.type !== 'warning') continue;

    const searchText = [
      msg.message,
      msg.details,
      msg.responseBody,
    ].filter(Boolean).join(' ').toLowerCase();

    for (const pattern of ROOT_CAUSE_PATTERNS) {
      const matched = pattern.patterns.some(re => re.test(searchText));
      if (!matched) continue;

      const existing = groups.get(pattern.rootCause);
      if (existing) {
        existing.affectedMessages.push(msg);
        // Update affected entities
        const tables = extractTablesFromUrls([msg]);
        tables.forEach(t => {
          if (!existing.affectedEntities.includes(t)) existing.affectedEntities.push(t);
        });
      } else {
        groups.set(pattern.rootCause, {
          rootCause: pattern.rootCause,
          label: pattern.label,
          severity: pattern.severity,
          description: '', // filled after collecting all messages
          suggestedFix: '', // filled after collecting all messages
          affectedMessages: [msg],
          affectedEntities: extractTablesFromUrls([msg]),
        });
      }
      break; // Only match first pattern per message
    }
  }

  // Now fill descriptions and fixes with the full message list
  const result: RootCauseGroup[] = [];
  for (const [rootCause, group] of groups) {
    const patternDef = ROOT_CAUSE_PATTERNS.find(p => p.rootCause === rootCause)!;
    group.description = patternDef.descriptionTemplate(group.affectedMessages);
    group.suggestedFix = patternDef.fixTemplate(group.affectedMessages);
    result.push(group);
  }

  // Sort: critical → high → medium → low
  const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  result.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return result;
}

/**
 * Classify severity of a network error based on HTTP status and response body.
 * Returns a Severity level.
 */
export function classifyNetworkSeverity(httpStatus: number, responseBody?: string): Severity {
  if (httpStatus >= 500) return 'critical';
  if (httpStatus === 401) return 'critical'; // Auth broken
  if (httpStatus === 403) {
    // RLS block is high, not critical (app still works for other users)
    if (responseBody?.includes('row-level security')) return 'high';
    return 'high';
  }
  if (httpStatus === 400) {
    // Schema errors are critical (all users affected)
    if (responseBody?.match(/column.*does not exist|relation.*does not exist/i)) return 'critical';
    return 'high';
  }
  if (httpStatus === 404) return 'medium';
  return 'low';
}

/**
 * Generate a suggested fix from a network error response body and URL.
 */
export function suggestFixFromNetworkError(
  url: string,
  httpStatus: number,
  responseBody?: string,
): string | undefined {
  if (!responseBody) return undefined;

  // Schema mismatch
  const columnMatch = responseBody.match(/column\s+"([^"]+)"\s+does not exist/i);
  if (columnMatch) {
    const column = columnMatch[1];
    return `Column "${column}" was not found. Search your service/hook files for "${column}" and update to the correct column name. Run any pending DB migrations if the column was recently renamed.`;
  }

  // Missing table
  const tableMatch = responseBody.match(/relation\s+"([^"]+)"\s+does not exist/i);
  if (tableMatch) {
    const table = tableMatch[1];
    return `Table "${table}" does not exist. Run a migration to create it, or check for a typo in your query.`;
  }

  // RLS block
  if (responseBody.includes('row-level security')) {
    const tableName = url.match(/\/rest\/v1\/([a-z_]+)/i)?.[1] ?? 'the table';
    return `RLS policy blocked this query on "${tableName}". Check Supabase → Policies and ensure the authenticated role has the required permission.`;
  }

  // Auth
  if (httpStatus === 401 || responseBody.match(/jwt|not authenticated/i)) {
    return `Authentication token is invalid or expired. Check session refresh logic and ensure \`supabase.auth.onAuthStateChange\` is handling token refresh correctly.`;
  }

  return undefined;
}

// ─── GitHub Issue Formatter ───────────────────────────────────────────────────

/**
 * Format messages as a GitHub issue body, ready to paste/file.
 */
export function formatAsGitHubIssue(
  messages: DebugMessage[],
  appState: { url: string; userAgent: string; viewport: { width: number; height: number } },
  actionTrail?: ActionTrailEntry[],
): string {
  const summary = generateSummary(messages);
  const rootCauses = detectRootCauseGroups(messages);
  const errors = messages.filter(m => m.type === 'error');
  const { browser, os } = parseUserAgent(appState.userAgent);

  const severityLabel = rootCauses.length > 0
    ? rootCauses[0].severity === 'critical' ? '🔴 Critical'
      : rootCauses[0].severity === 'high' ? '🟠 High'
      : rootCauses[0].severity === 'medium' ? '🟡 Medium'
      : '🟢 Low'
    : errors.length > 0 ? '🔴 Critical' : '🟡 Medium';

  let md = `## Bug Report\n\n`;
  md += `**Severity:** ${severityLabel}\n\n`;

  if (rootCauses.length > 0) {
    md += `## Root Cause\n\n`;
    md += `${rootCauses[0].description}\n\n`;
    md += `**Suggested fix:** ${rootCauses[0].suggestedFix}\n\n`;
  } else if (errors.length > 0) {
    md += `## Error\n\n`;
    md += `\`\`\`\n${errors[0].message}\n\`\`\`\n\n`;
    if (errors[0].details) {
      md += `**Details:**\n\`\`\`\n${errors[0].details}\n\`\`\`\n\n`;
    }
  }

  md += `## Steps to Reproduce\n\n`;
  if (actionTrail && actionTrail.length > 0) {
    const recent = actionTrail.slice(-8);
    recent.forEach((a, i) => {
      md += `${i + 1}. **${a.action}**: ${a.description}\n`;
    });
  } else {
    md += `1. <!-- Describe steps here -->\n`;
  }
  md += `\n`;

  md += `## Expected Behavior\n\n<!-- What should happen? -->\n\n`;
  md += `## Actual Behavior\n\n`;
  if (errors.length > 0) {
    md += `${errors.length} error(s) detected:\n`;
    errors.slice(0, 3).forEach(e => {
      md += `- \`${e.message}\`\n`;
    });
  } else {
    md += `<!-- Describe what happens instead -->\n`;
  }
  md += `\n`;

  md += `## Environment\n\n`;
  md += `| | |\n|---|---|\n`;
  md += `| URL | \`${appState.url}\` |\n`;
  md += `| Browser | ${browser} |\n`;
  md += `| OS | ${os} |\n`;
  md += `| Viewport | ${appState.viewport.width}×${appState.viewport.height} |\n`;
  md += `| Generated | ${new Date().toISOString()} |\n\n`;

  md += `## Debug Summary\n\n`;
  md += `| | |\n|---|---|\n`;
  md += `| Errors | ${summary.errors} |\n`;
  md += `| Warnings | ${summary.warnings} |\n`;
  md += `| Unique Issues | ${summary.uniqueErrors} |\n`;
  if (summary.topIssue) {
    md += `| Top Issue | ${summary.topIssue} |\n`;
  }

  if (rootCauses.length > 1) {
    md += `\n## Additional Issues\n\n`;
    rootCauses.slice(1).forEach(rc => {
      md += `### ${rc.label}\n${rc.description}\n\n**Fix:** ${rc.suggestedFix}\n\n`;
    });
  }

  return md;
}

// ─── Parse user agent into readable format ────────────────────────────────────

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

// Format action trail entry for display
function formatActionIcon(action: ActionTrailEntry['action']): string {
  switch (action) {
    case 'navigation': return '🧭';
    case 'click': return '👆';
    case 'api_call': return '🔗';
    case 'state_change': return '⚡';
    case 'user_input': return '⌨️';
    default: return '•';
  }
}

// Format as Markdown for Claude Code with AI pre-prompt
export function formatAsMarkdown(
  messages: DebugMessage[],
  appState: { url: string; userAgent: string; viewport: { width: number; height: number } },
  actionTrail?: ActionTrailEntry[]
): string {
  const summary = generateSummary(messages);
  const groups = groupErrors(messages);
  const { browser, os } = parseUserAgent(appState.userAgent);

  // AI Pre-prompt Header - frames the document for Claude Code
  let md = `# CallVault Bug Report\n\n`;
  md += `> **Context for AI:** This is a structured bug report from CallVault's debug panel.\n`;
  md += `> Analyze the errors below, identify root causes, and suggest specific fixes.\n`;
  md += `> Reference file paths when available. Prioritize errors over warnings.\n\n`;

  md += `---\n\n`;

  md += `**Generated:** ${new Date().toISOString()}\n`;
  md += `**URL:** ${appState.url}\n`;
  md += `**Environment:** ${browser} on ${os} (${appState.viewport.width}x${appState.viewport.height})\n\n`;

  // Summary table
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

  // Action Trail (User Journey) - shows what happened before errors
  if (actionTrail && actionTrail.length > 0) {
    md += `## User Journey (Before Errors)\n\n`;
    md += `> What the user did leading up to the errors:\n\n`;

    // Show last 10 actions in chronological order
    const recentActions = actionTrail.slice(-10);
    for (const action of recentActions) {
      const time = new Date(action.timestamp).toLocaleTimeString();
      const icon = formatActionIcon(action.action);
      md += `- \`${time}\` ${icon} **${action.action}**: ${action.description}`;
      if (action.details) {
        md += ` _(${action.details})_`;
      }
      md += `\n`;
    }
    md += `\n`;
  }

  // Error Groups
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

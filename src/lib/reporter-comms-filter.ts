/**
 * Default-deny reporter summary sanitizer (D-02).
 *
 * This is the single most security-load-bearing artifact in Phase 23. A leaked
 * file path, SHA, stack trace, or internal term ("agent", "Autopilot", ...)
 * reaching a customer is a brand failure ("AI-ready, not AI-powered").
 *
 * The function is an ALLOWLIST GATE, not a search-and-replace. If ANY reject
 * rule fires, it returns the fixed FALLBACK_COPY — never a partially-redacted
 * leak. Only text that trips zero reject rules AND passes the plain-English
 * allowlist is returned verbatim.
 *
 * MIRRORED in /Users/admin/dev/autopilot/src/lib/reporter-comms-filter.ts —
 * the two implementations MUST stay behaviorally identical. They share no
 * import (cross-repo rule: integrate only through Supabase). Keep zero deps.
 */

export const FALLBACK_COPY =
  "This has been fixed and verified in the live app. Thanks for reporting it.";

export interface SanitizeResult {
  ok: boolean;
  text: string;
  redactions: string[];
}

/** Case-insensitive internal terms that must never reach a customer. */
const BANNED_TERMS = [
  "agent",
  "autopilot",
  "codex",
  "claude",
  "llm",
  "model",
  "prompt",
  "token",
  "runner",
  "worktree",
  "branch",
  "diff",
  "push-gate",
  "sentry",
  "stack",
  "trace",
  "deploy sha",
  "ai-powered",
];

/** ANSI escape sequences (terminal colors) — a stack/log tell. */
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/;

interface RejectRule {
  name: string;
  test: (raw: string) => boolean;
}

/**
 * Reject rules, ordered. Each contributes a named entry to `redactions` when it
 * fires. These detect INTERNAL TELLS; the allowlist below is the positive gate.
 */
const REJECT_RULES: RejectRule[] = [
  {
    name: "code_formatting",
    // Any backtick or fenced block.
    test: (raw) => raw.includes("`"),
  },
  {
    name: "file_path",
    // POSIX absolute/relative paths, leading source dirs, and *.ext:line frames.
    test: (raw) =>
      /(^|\s)\/[\w.-]+\/[\w./-]+/.test(raw) || // absolute /a/b
      /(^|\s)(src|supabase|functions|lib|components|hooks|services)\/[\w./-]+/.test(
        raw,
      ) || // leading source dir
      /[\w-]+\/[\w-]+\.\w+/.test(raw) || // foo/bar.ts
      /\.\w+:\d+/.test(raw), // file.ts:42 frame ref
  },
  {
    name: "sha",
    // 7–40 hex chars (a git SHA), especially near commit/sha/merged.
    test: (raw) => /\b[0-9a-f]{7,40}\b/i.test(raw),
  },
  {
    name: "stack_trace",
    // Error class prefixes, "at fn (...)" frames, line:col, ANSI escapes.
    test: (raw) =>
      /\b\w*Error:/.test(raw) ||
      /\bat\s+\S+\s*\(/.test(raw) ||
      /:\d+:\d+/.test(raw) ||
      ANSI_RE.test(raw),
  },
  {
    name: "banned_term",
    test: (raw) => {
      const lower = raw.toLowerCase();
      return BANNED_TERMS.some((term) =>
        new RegExp(`\\b${escapeRegExp(term)}\\b`).test(lower),
      );
    },
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Plain-English allowlist: must ALSO pass for ok=true. */
const PLAIN_TEXT_RE = /^[A-Za-z0-9 .,!?'"():;\-]+$/;

function passesAllowlist(trimmed: string): boolean {
  if (trimmed.length === 0) return false;
  if (trimmed.length > 280) return false;
  if (/[\r\n]/.test(trimmed)) return false;
  return PLAIN_TEXT_RE.test(trimmed);
}

/**
 * Default-deny sanitizer. Returns the trimmed input only when it trips no
 * reject rule and passes the plain-English allowlist; otherwise FALLBACK_COPY.
 */
export function sanitizeReporterSummary(raw: string): SanitizeResult {
  const input = typeof raw === "string" ? raw : "";
  const redactions: string[] = [];

  for (const rule of REJECT_RULES) {
    if (rule.test(input)) redactions.push(rule.name);
  }

  const trimmed = input.trim();

  if (redactions.length > 0 || !passesAllowlist(trimmed)) {
    return { ok: false, text: FALLBACK_COPY, redactions };
  }

  return { ok: true, text: trimmed, redactions: [] };
}

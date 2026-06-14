/**
 * sentry-resolve pure logic — testable in isolation from the request handler.
 *
 * Exports:
 *   - resolveInputSchema: validates Sentry issue ids accepted by the resolver
 *   - stripFingerprintPrefix(issueId): removes the `sentry:` ticket prefix
 *   - buildResolveUrl(org, issueId): builds the Sentry organization issue URL
 *   - RESOLVE_BODY: the Sentry resolved-status payload
 */
import { z } from "https://esm.sh/zod@3.23.8";

export const resolveInputSchema = z.object({
  issue_id: z.string().trim().min(1).max(256).regex(
    /^(sentry:)?\d+$/,
    "issue_id must be numeric",
  ),
});

export function stripFingerprintPrefix(issueId: string): string {
  return issueId.replace(/^sentry:/, "");
}

export function buildResolveUrl(org: string, issueId: string): string {
  return `https://sentry.io/api/0/organizations/${org}/issues/${
    stripFingerprintPrefix(issueId)
  }/`;
}

export const RESOLVE_BODY = { status: "resolved" } as const;

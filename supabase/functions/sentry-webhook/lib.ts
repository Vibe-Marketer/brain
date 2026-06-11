/**
 * sentry-webhook pure logic — testable in isolation from the request handler.
 *
 * Exports (contracts pinned by __tests__/sentry-webhook.test.ts):
 *   - mapSeverity(level): "high" | "medium" | "low"  (never "critical")
 *   - deriveFingerprint(payload): string | null       (sentry:<issue_id>)
 *   - verifySentrySignature(rawBody, headerValue, secret): Promise<boolean>
 *   - issueAlertSchema: zod schema for the event_alert payload
 */
import { z } from "https://esm.sh/zod@3.23.8";
import {
  computeHmacSha256Signature,
  timingSafeEqualString,
} from "../_shared/webhook-signing.ts";

/**
 * Level → severity (locked decision). Telemetry NEVER auto-assigns "critical".
 *   fatal | error  -> high
 *   warning        -> medium
 *   everything else (info, debug, unknown, missing) -> low
 */
export function mapSeverity(level: unknown): "high" | "medium" | "low" {
  switch (String(level ?? "").toLowerCase()) {
    case "fatal":
    case "error":
      return "high";
    case "warning":
      return "medium";
    default:
      return "low";
  }
}

/**
 * Dedup fingerprint from `data.event.issue_id` — NOT the payload's
 * `fingerprint` field (which is `["{{ default }}"]` for default-grouped
 * issues and would collide across every default error). Returns null when
 * the issue_id is absent so the handler can 400 rather than write garbage.
 */
export function deriveFingerprint(payload: unknown): string | null {
  const issueId = (payload as { data?: { event?: { issue_id?: unknown } } })
    ?.data?.event?.issue_id;
  if (issueId === undefined || issueId === null || issueId === "") return null;
  return "sentry:" + String(issueId);
}

/**
 * Verify the Sentry `sentry-hook-signature` header against the raw body.
 *
 * Sentry sends a BARE hex HMAC-SHA256 digest (no `sha256=` prefix). Our shared
 * `computeHmacSha256Signature` returns GitHub-style `sha256=<hex>`, so we
 * prefix the incoming bare-hex header before the constant-time compare. The
 * raw body (not a re-stringified parse) MUST be passed in.
 */
export async function verifySentrySignature(
  rawBody: string,
  headerValue: string,
  secret: string,
): Promise<boolean> {
  if (!headerValue || !secret) return false;
  const expected = await computeHmacSha256Signature(rawBody, secret);
  // Reconcile: Sentry header is bare hex; our helper yields `sha256=<hex>`.
  const bareHeader = headerValue.startsWith("sha256=")
    ? headerValue
    : "sha256=" + headerValue;
  return timingSafeEqualString(expected, bareHeader);
}

/**
 * zod schema for the Sentry `event_alert` payload. Requires `data.event` with
 * an `issue_id` (string or number); passes through unknown keys; caps string
 * lengths defensively against oversized injected fields.
 */
const cappedString = z.string().max(8192);

const eventSchema = z
  .object({
    issue_id: z.union([z.string().max(256), z.number()]),
    title: cappedString.optional(),
    culprit: cappedString.optional(),
    level: cappedString.optional(),
    platform: cappedString.optional(),
    release: cappedString.nullable().optional(),
    web_url: cappedString.optional(),
    issue_url: cappedString.optional(),
    event_id: cappedString.optional(),
    tags: z.array(z.array(z.any())).optional(),
    datetime: cappedString.optional(),
  })
  .passthrough();

export const issueAlertSchema = z
  .object({
    action: cappedString.optional(),
    installation: z.record(z.any()).optional(),
    actor: z.record(z.any()).optional(),
    data: z
      .object({
        event: eventSchema,
        triggered_rule: cappedString.nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type IssueAlertPayload = z.infer<typeof issueAlertSchema>;

/** Pull a tag value (e.g. "environment") out of Sentry's `[[k,v],...]` tags. */
export function tagValue(
  tags: unknown,
  key: string,
): string | null {
  if (!Array.isArray(tags)) return null;
  for (const pair of tags) {
    if (Array.isArray(pair) && pair[0] === key) {
      return pair[1] === undefined || pair[1] === null ? null : String(pair[1]);
    }
  }
  return null;
}

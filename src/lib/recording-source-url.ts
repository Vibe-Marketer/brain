/**
 * Resolves the canonical source/share URL for a recording from any storage location.
 *
 * Manual-import recordings written via `save-pasted-transcript` persist the user-pasted
 * Fathom/Zoom share link inside `source_metadata.share_url` / `source_metadata.source_url`
 * because the `recordings` table has no top-level `share_url` column (that column only
 * exists on the legacy `fathom_raw_calls` table). UI components that need to render an
 * "Open in Fathom" / "Open in Zoom" affordance previously only read `call.share_url`,
 * which is always undefined for paste-imports — so the open button never appeared.
 *
 * This helper unifies the lookup so every call-detail surface renders the affordance
 * regardless of which storage path populated the link.
 */
export function resolveShareUrl(
  call: {
    share_url?: string | null;
    source_metadata?: Record<string, unknown> | null;
  } | null | undefined,
): string | null {
  if (!call) return null;
  if (typeof call.share_url === 'string' && call.share_url.length > 0) {
    return call.share_url;
  }
  const meta = call.source_metadata;
  if (meta && typeof meta === 'object') {
    const fromShare = meta.share_url;
    if (typeof fromShare === 'string' && fromShare.length > 0) return fromShare;
    const fromSource = meta.source_url;
    if (typeof fromSource === 'string' && fromSource.length > 0) return fromSource;
  }
  return null;
}

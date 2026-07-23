/**
 * ConnectionHealthGate — raises the login-time connection-health popup.
 *
 * Mounted once, globally, in the authenticated Layout. It self-gates:
 *   - reads connection health across all sources (shared bundle query, no
 *     extra network cost),
 *   - opens {@link ConnectionHealthDialog} at most once per browser session
 *     per user (sessionStorage dedupe, so route changes / remounts don't
 *     re-nag), and
 *   - routes "Review connections" to the integrations settings page where the
 *     reconnect flow lives.
 *
 * The connector-health query resolves within the page's own initial network
 * activity, so opening the dialog the instant it settles means the very
 * first paint of the app can already be covered by a modal — swallowing
 * whatever the user was about to click (e.g. the topbar logo). OPEN_DELAY_MS
 * gives the page a beat to render before the interstitial takes over.
 *
 * Renders nothing when every connection is healthy.
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useConnectionHealth } from "@/components/connectors/hooks/useConnector";
import { ConnectionHealthDialog } from "@/components/dialogs/ConnectionHealthDialog";

const STORAGE_PREFIX = "cv:conn-health-shown:";
const RECONNECT_ROUTE = "/settings/integrations";
// Grace period before the auto-popup takes over the screen — see file header.
const OPEN_DELAY_MS = 1200;

export function ConnectionHealthGate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { needsAttention, isFetched } = useConnectionHealth();

  const [open, setOpen] = React.useState(false);
  // Once dismissed this session we never auto-reopen, even if a later refetch
  // surfaces the same broken sources.
  const [dismissed, setDismissed] = React.useState(false);

  const storageKey = user ? `${STORAGE_PREFIX}${user.id}` : null;
  const hasAttention = needsAttention.length > 0;
  // Guards against scheduling more than one open timer across re-renders
  // (e.g. the bundle query refetching while the timer is still pending).
  const scheduledRef = React.useRef(false);

  React.useEffect(() => {
    if (!isFetched || open || dismissed || !storageKey || !hasAttention) return;
    if (scheduledRef.current) return;

    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(storageKey) === "1";
    } catch {
      // sessionStorage can throw in private-mode / sandboxed contexts — fail
      // open (show once) rather than suppress the alert entirely.
    }
    if (alreadyShown) return;

    scheduledRef.current = true;
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore — dedupe is best-effort */
    }

    const timer = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isFetched, open, dismissed, storageKey, hasAttention]);

  const handleClose = React.useCallback(() => {
    setOpen(false);
    setDismissed(true);
  }, []);

  if (!hasAttention) return null;

  return (
    <ConnectionHealthDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
      sources={needsAttention}
      onFixNow={() => {
        handleClose();
        navigate(RECONNECT_ROUTE);
      }}
    />
  );
}

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
 * Renders nothing when every connection is healthy.
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useConnectionHealth } from "@/components/connectors/hooks/useConnector";
import { ConnectionHealthDialog } from "@/components/dialogs/ConnectionHealthDialog";

const STORAGE_PREFIX = "cv:conn-health-shown:";
const RECONNECT_ROUTE = "/settings/integrations";

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

  React.useEffect(() => {
    if (!isFetched || open || dismissed || !storageKey || !hasAttention) return;

    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(storageKey) === "1";
    } catch {
      // sessionStorage can throw in private-mode / sandboxed contexts — fail
      // open (show once) rather than suppress the alert entirely.
    }
    if (alreadyShown) return;

    setOpen(true);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore — dedupe is best-effort */
    }
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

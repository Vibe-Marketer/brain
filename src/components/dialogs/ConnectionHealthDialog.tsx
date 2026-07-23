/**
 * ConnectionHealthDialog — login-time alert for broken connections.
 *
 * Raised by {@link ConnectionHealthGate} once per session when one or more of
 * the user's import sources need attention (a revoked OAuth token, a dead API
 * key, or a persistent sync error). A revoked token is otherwise invisible
 * until someone goes looking — this closes that gap by surfacing it the moment
 * the user lands in the app.
 *
 * Presentational only: the parent owns the open state, the session-dedupe, and
 * the navigation target.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RiAlertLine, RiPlugLine, RiArrowRightLine } from "@remixicon/react";
import { getConnectorAdapter } from "@/components/connectors/registry/connectorRegistry";
import type { ConnectorStatus } from "@/components/connectors/registry/types";

interface ConnectionHealthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: ConnectorStatus[];
  onFixNow: () => void;
}

/** Provider label + icon, falling back gracefully for unregistered adapters. */
function useProviderPresentation(sourceApp: ConnectorStatus["sourceApp"]) {
  try {
    const adapter = getConnectorAdapter(sourceApp);
    return { label: adapter.metadata.label, Icon: adapter.metadata.icon };
  } catch {
    return { label: sourceApp, Icon: RiPlugLine };
  }
}

/** One-line, plain-English explanation of what the user should do. */
function messageFor(status: ConnectorStatus): string {
  if (status.lifecycleStatus === "reconnect_required") {
    return "Sign in again to keep importing your calls — the connection expired or was revoked.";
  }
  // "error" — prefer the persisted operator message, else a safe default.
  return (
    status.errorMessage ??
    "We hit a problem syncing this connection. Reconnecting usually fixes it."
  );
}

function ConnectionRow({ status }: { status: ConnectorStatus }) {
  const { label, Icon } = useProviderPresentation(status.sourceApp);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {label}
          </span>
          <span className="shrink-0 rounded-full bg-vibe-orange/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-vibe-orange">
            {status.statusLabel}
          </span>
        </div>
        {status.accountEmail && (
          <p className="truncate text-xs text-muted-foreground">
            {status.accountEmail}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {messageFor(status)}
        </p>
      </div>
    </div>
  );
}

export function ConnectionHealthDialog({
  open,
  onOpenChange,
  sources,
  onFixNow,
}: ConnectionHealthDialogProps) {
  const count = sources.length;
  const plural = count > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        data-testid="connection-health-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiAlertLine className="h-5 w-5 text-vibe-orange" />
            {plural
              ? `${count} connections need attention`
              : "A connection needs attention"}
          </DialogTitle>
          <DialogDescription>
            {plural
              ? "These sources stopped importing your calls. Reconnect them to resume syncing."
              : "This source stopped importing your calls. Reconnect it to resume syncing."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {sources.map((status) => (
            <ConnectionRow
              key={`${status.sourceApp}:${status.sourceId ?? status.accountEmail ?? "unknown"}`}
              status={status}
            />
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="hollow"
            size="sm"
            onClick={() => onOpenChange(false)}
            data-testid="connection-health-later"
          >
            Later
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onFixNow}
            data-testid="connection-health-fix-now"
          >
            Review connections
            <RiArrowRightLine className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

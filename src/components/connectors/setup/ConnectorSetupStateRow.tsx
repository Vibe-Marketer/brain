import * as React from "react";
import { RiExternalLinkLine, RiLoader4Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ConnectorAdapter } from "../registry/types";

export type ConnectorClusterState =
  | "loading"
  | "disconnected"
  | "connected"
  | "editing"
  | "saving"
  | "waiting_for_webhook"
  | "webhook_verified"
  | "disconnecting"
  | "error";

export interface ConnectorSetupStateRowProps {
  state: ConnectorClusterState;
  adapter: ConnectorAdapter;
  onConnectOAuth?: () => void;
  onEditCredentials?: () => void;
  onCancelEdit?: () => void;
  saving: boolean;
  disconnecting: boolean;
}

/**
 * Action row that surfaces the connector's current verification state
 * (waiting / verified) and any contextual primary actions
 * (connect, reconnect, cancel edit) above the credential form.
 */
export function ConnectorSetupStateRow({
  state,
  adapter,
  onConnectOAuth,
  onEditCredentials,
  onCancelEdit,
  saving,
  disconnecting,
}: ConnectorSetupStateRowProps) {
  const hasActions = Boolean(
    onConnectOAuth || onEditCredentials || onCancelEdit || disconnecting,
  );

  if (
    !hasActions &&
    state !== "waiting_for_webhook" &&
    state !== "webhook_verified"
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        {state === "webhook_verified" ? (
          <StatusBadge variant="success" label="Verified" />
        ) : state === "waiting_for_webhook" ? (
          <StatusBadge variant="warning" label="Waiting" />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onConnectOAuth ? (
          <Button type="button" onClick={onConnectOAuth} disabled={saving}>
            {saving ? (
              <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RiExternalLinkLine className="mr-2 h-4 w-4" />
            )}
            Connect {adapter.metadata.label}
          </Button>
        ) : null}
        {onEditCredentials ? (
          <Button type="button" variant="hollow" onClick={onEditCredentials}>
            Reconnect
          </Button>
        ) : null}
        {onCancelEdit ? (
          <Button type="button" variant="hollow" onClick={onCancelEdit}>
            Cancel
          </Button>
        ) : null}
        {disconnecting ? (
          <span className="inline-flex items-center text-xs text-muted-foreground">
            <RiLoader4Line className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Disconnecting
          </span>
        ) : null}
      </div>
    </div>
  );
}

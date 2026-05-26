import * as React from "react";
import {
  RiDownloadLine,
  RiExternalLinkLine,
  RiLoader4Line,
  RiPlugLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { compareSemver } from "@/lib/semver";
import { ConnectorSetupInstructions } from "./ConnectorSetupInstructions";

export interface ConnectorBrowserBridgeNoticeProps {
  connected: boolean;
  helperText?: string;
  bridgeMessage?: string | null;
  installedVersion?: string | null;
  latestVersion: string;
  saving: boolean;
  onConnect?: () => void;
}

/**
 * Plaud-only browser-bridge notice. Renders the install/connect instructions
 * and the bridge version status. Lives outside ConnectorSetupCluster so the
 * cluster can stay focused on orchestration.
 */
export function ConnectorBrowserBridgeNotice({
  connected,
  helperText,
  bridgeMessage,
  installedVersion,
  latestVersion,
  saving,
  onConnect,
}: ConnectorBrowserBridgeNoticeProps) {
  const hasBridge = Boolean(installedVersion);
  const bridgeOutdated =
    hasBridge && compareSemver(installedVersion, latestVersion) < 0;
  const bridgeCurrent = hasBridge && !bridgeOutdated;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card">
              <RiPlugLine className="h-4 w-4 text-muted-foreground" />
            </div>
            <ConnectorSetupInstructions
              title={
                connected
                  ? "Browser bridge connected"
                  : "Connect with Plaud Web token"
              }
              description={
                helperText ??
                "Plaud does not currently provide CallVault with a durable production OAuth connection, so this beta uses a temporary browser bridge to capture your Plaud Web session token."
              }
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge variant="beta" label="Bridge Beta" />
                  {bridgeCurrent ? (
                    <StatusBadge
                      variant="success"
                      label={`Installed v${installedVersion}`}
                    />
                  ) : hasBridge ? (
                    <StatusBadge
                      variant="warning"
                      label={`Installed v${installedVersion}`}
                    />
                  ) : (
                    <StatusBadge variant="setupNeeded" label="Not installed" />
                  )}
                  <StatusBadge variant="info" label={`Latest v${latestVersion}`} />
                </div>
                {bridgeMessage ? (
                  <p className="text-xs text-muted-foreground">{bridgeMessage}</p>
                ) : null}
                {bridgeOutdated ? (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                    A newer CallVault Plaud Bridge is available. Remove the old extension, download the latest bridge, then load the new folder in Chrome.
                  </p>
                ) : null}
              </div>
            </ConnectorSetupInstructions>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {onConnect ? (
              <Button type="button" size="sm" onClick={onConnect} disabled={saving}>
                {saving ? (
                  <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RiExternalLinkLine className="mr-2 h-4 w-4" />
                )}
                {connected ? "Reconnect Plaud" : "Connect Plaud"}
              </Button>
            ) : null}
            <Button type="button" variant="hollow" size="sm" asChild>
              <a href="/downloads/callvault-plaud-connector.zip" download>
                <RiDownloadLine className="mr-2 h-4 w-4" />
                Download bridge
              </a>
            </Button>
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-card p-3">
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li><span className="font-semibold text-foreground">1. Download Bridge.</span> Unzip it, open Chrome extensions, enable Developer mode, and load the bridge folder.</li>
            <li><span className="font-semibold text-foreground">2. Refresh CallVault.</span> This panel should show the installed bridge version before you continue.</li>
            <li><span className="font-semibold text-foreground">3. Connect.</span> Click Connect Plaud, sign in to Plaud Web, then open or refresh a recording if Plaud does not make an authenticated request automatically.</li>
            <li><span className="font-semibold text-foreground">4. Sync while connected.</span> This beta connection may expire when Plaud rotates your web session, so reconnect when CallVault asks.</li>
          </ol>
          {!connected ? (
            <div className="mt-3 border-t border-border/60 pt-3">
              <Button type="button" variant="hollow" size="sm" asChild>
                <a href="https://web.plaud.ai" target="_blank" rel="noreferrer">
                  <RiExternalLinkLine className="mr-2 h-4 w-4" />
                  Open Plaud Web only
                </a>
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Use this only if you need to sign in, refresh Plaud, or click a recording before trying Connect Plaud again. It does not connect CallVault by itself.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

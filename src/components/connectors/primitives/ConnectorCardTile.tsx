/**
 * ConnectorCardTile — 100px-wide vendor tile with optional on/off switch.
 *
 * Replaces IntegrationSourceCard. Resolves icon/label via useConnectorMeta.
 */
import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useConnectorMeta, type ConnectorCardStatus } from "./ConnectorCard";

export interface ConnectorCardTileProps {
  sourceApp: string;
  status: ConnectorCardStatus;
  label?: string;
  iconOverride?: React.ReactNode;
  enabled?: boolean;
  onSwitchChange?: (next: boolean) => void;
  switchDisabled?: boolean;
  onClick?: () => void;
  /** Back-compat alias for onClick. */
  onCardClick?: () => void;
}

export function ConnectorCardTile({
  sourceApp,
  status,
  label,
  iconOverride,
  enabled,
  onSwitchChange,
  switchDisabled,
  onClick,
  onCardClick,
}: ConnectorCardTileProps) {
  const { label: resolvedLabel, Icon } = useConnectorMeta(sourceApp, label);
  const connected = status === "connected";
  const handleClick = onClick ?? onCardClick;
  const iconNode = iconOverride ?? (Icon ? <Icon className="h-6 w-6" /> : null);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        aria-label={resolvedLabel}
        className={cn(
          "w-[100px] px-3 py-3 rounded-xl",
          "flex flex-col items-center justify-center gap-1.5",
          "transition-all duration-200 bg-card border hover:shadow-sm",
          connected
            ? "border-border hover:border-success/50"
            : "border-border hover:border-muted-foreground/50",
          !connected && "opacity-70",
        )}
      >
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            connected ? "bg-success/10" : "bg-muted",
          )}
        >
          <span className={cn(!connected && "grayscale opacity-60")}>
            {iconNode}
          </span>
        </div>
        <span className="text-xs font-medium text-foreground leading-tight">
          {resolvedLabel}
        </span>
        {connected ? (
          <span className="text-2xs font-medium text-success flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Connected
          </span>
        ) : (
          <span className="text-2xs font-medium text-vibe-orange">Connect →</span>
        )}
      </button>
      {connected && onSwitchChange && (
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-2xs font-medium uppercase",
              !enabled ? "text-muted-foreground" : "text-muted-foreground/40",
            )}
          >
            off
          </span>
          <Switch
            checked={!!enabled}
            onCheckedChange={onSwitchChange}
            disabled={switchDisabled}
            className="data-[state=checked]:bg-success"
          />
          <span
            className={cn(
              "text-2xs font-medium uppercase",
              enabled ? "text-success" : "text-muted-foreground/40",
            )}
          >
            on
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * ConnectorCard — base presentational primitive for vendor cards.
 *
 * Resolves shared metadata (icon, label, description) from the source registry
 * so the four visual variants (Square, Tile, Row, Full) don't each
 * re-implement that lookup. Pure: no useState, no useEffect.
 *
 * Variants compose this primitive by either:
 *   1. Calling `<ConnectorCard>` directly for the standard horizontal
 *      "icon + label + status + children" layout, or
 *   2. Calling `useConnectorMeta(sourceApp)` to resolve icon/label and
 *      building their own layout (Square/Tile do this).
 */
import * as React from "react";
import { tryGetSourceConfig, type SourceConfig } from "@/config/source-registry";
import { cn } from "@/lib/utils";

export type ConnectorCardStatus =
  | "connected"
  | "not-connected"
  | "syncing"
  | "error"
  | "paused"
  | "expired";

export interface ConnectorMeta {
  label: string;
  Icon: SourceConfig["icon"] | null;
  brandColor?: string;
  config: SourceConfig | undefined;
}

/** Hook (pure function — no React state) resolving registry metadata. */
export function useConnectorMeta(
  sourceApp: string,
  labelOverride?: string,
): ConnectorMeta {
  const config = tryGetSourceConfig(sourceApp);
  return {
    label: labelOverride ?? config?.label ?? sourceApp,
    Icon: config?.icon ?? null,
    config,
  };
}

export interface ConnectorCardProps {
  sourceApp: string;
  status: ConnectorCardStatus;
  label?: string;
  description?: string;
  iconOverride?: React.ReactNode;
  iconSize?: number;
  children?: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}

export function ConnectorCard({
  sourceApp,
  label,
  description,
  iconOverride,
  iconSize = 36,
  children,
  onClick,
  ariaLabel,
  className,
}: ConnectorCardProps) {
  const { label: resolvedLabel, Icon } = useConnectorMeta(sourceApp, label);
  const iconNode =
    iconOverride ?? (Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null);

  const inner = (
    <>
      <div
        className="flex shrink-0 items-center justify-center rounded-lg bg-muted border border-border"
        style={{ width: iconSize, height: iconSize }}
      >
        {iconNode}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground leading-tight">
          {resolvedLabel}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug truncate">
            {description}
          </p>
        )}
      </div>
      {children}
    </>
  );

  const containerClass = cn(
    "flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left",
    "transition-colors",
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? resolvedLabel}
        className={cn(containerClass, "hover:bg-muted/40 cursor-pointer")}
      >
        {inner}
      </button>
    );
  }
  return <div className={containerClass}>{inner}</div>;
}

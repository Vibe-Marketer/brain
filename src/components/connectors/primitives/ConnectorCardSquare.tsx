/**
 * ConnectorCardSquare — 56px square connector button.
 *
 * Replaces CompactIntegrationButton. Resolves icon/label via useConnectorMeta.
 */
import * as React from "react";
import { RiCheckLine, RiInformationLine } from "@remixicon/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useConnectorMeta, type ConnectorCardStatus } from "./ConnectorCard";

export interface ConnectorCardSquareProps {
  sourceApp: string;
  status: ConnectorCardStatus;
  label?: string;
  iconOverride?: React.ReactNode;
  tooltipFooter?: React.ReactNode;
  onClick?: () => void;
}

export function ConnectorCardSquare({
  sourceApp,
  status,
  label,
  iconOverride,
  tooltipFooter,
  onClick,
}: ConnectorCardSquareProps) {
  const { label: resolvedLabel, Icon } = useConnectorMeta(sourceApp, label);
  const connected = status === "connected";
  const iconNode = iconOverride ?? (Icon ? <Icon className="h-7 w-7" /> : null);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-label={resolvedLabel}
            className={cn(
              "w-14 h-14 relative rounded-xl flex items-center justify-center",
              "transition-all duration-200",
              "ring-2 ring-offset-2 ring-offset-background",
              connected ? "ring-success" : "ring-border",
              !connected && "opacity-60",
              "hover:scale-105 hover:shadow-md",
              "bg-card border border-border shadow-sm",
            )}
          >
            <span className={cn(!connected && "grayscale")}>{iconNode}</span>
            {connected && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success flex items-center justify-center shadow-sm">
                <RiCheckLine className="h-2.5 w-2.5 text-white" />
              </span>
            )}
            {connected && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-card border border-border flex items-center justify-center shadow-sm">
                <RiInformationLine className="h-2.5 w-2.5 text-muted-foreground" />
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[200px]">
          <div className="space-y-0.5">
            <p className="font-medium">
              {resolvedLabel} {connected ? "- Connected" : "- Not Connected"}
            </p>
            {tooltipFooter}
            {!connected && !tooltipFooter && (
              <p className="text-muted-foreground">Click to connect</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

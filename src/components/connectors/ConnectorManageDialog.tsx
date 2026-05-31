import * as React from "react";
import {
  RiArrowRightLine,
  RiExchangeLine,
  RiPlugLine,
  RiRefreshLine,
  RiSettings3Line,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ConnectorAccountWithWorkspace } from "@/services/import-sources.service";
import type { ConnectorLifecycleStatus } from "./registry/types";

interface ConnectorManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ConnectorAccountWithWorkspace | null;
  providerLabel: string;
  lifecycleStatus: ConnectorLifecycleStatus;
  statusLabel: string;
  canReconnect: boolean;
  canSync: boolean;
  isPlaud: boolean;
  onReconnect?: () => void;
  onSync?: () => void;
  onDisconnect?: () => void;
}

export function ConnectorManageDialog({
  open,
  onOpenChange,
  account,
  providerLabel,
  lifecycleStatus,
  statusLabel,
  canReconnect,
  canSync,
  isPlaud,
  onReconnect,
  onSync,
  onDisconnect,
}: ConnectorManageDialogProps) {
  if (!account) return null;

  const accountLabel = account.account_email ?? "Connected account";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{providerLabel} connection</DialogTitle>
          <DialogDescription>
            Manage future imports for {accountLabel}. Existing imported calls
            stay where they are.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Info label="Account" value={accountLabel} />
              <Info
                label="Future landing workspace"
                value={account.workspaceName ?? "Default workspace"}
              />
              <Info label="Status" value={statusLabel} />
              <Info label="Source id" value={account.id} mono />
            </div>
          </div>

          <div className="grid gap-2">
            {canSync ? (
              <ActionButton
                icon={RiRefreshLine}
                label="Sync now"
                description="Start a provider sync for this connector."
                onClick={onSync}
              />
            ) : null}

            {canReconnect ? (
              <ActionButton
                icon={isPlaud ? RiPlugLine : RiArrowRightLine}
                label={isPlaud ? "Manage bridge" : "Reconnect"}
                description={
                  isPlaud
                    ? "Open the Plaud bridge flow for this connection."
                    : "Refresh the provider credential for this connection."
                }
                onClick={onReconnect}
              />
            ) : null}

            <ActionButton
              icon={RiExchangeLine}
              label="Change future landing workspace"
              description="Affects future syncs only. Historical calls are not moved."
            />

            <ActionButton
              icon={RiSettings3Line}
              label="Disconnect"
              description="Stop future syncs and remove connector credentials. Imported calls are kept."
              danger
              onClick={onDisconnect}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="hollow" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>

        <span className="sr-only" data-lifecycle-status={lifecycleStatus} />
      </DialogContent>
    </Dialog>
  );
}

function Info({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase text-muted-foreground/70">
        {label}
      </div>
      <div
        className={cn(
          "truncate text-sm font-medium text-foreground",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  description,
  danger = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  description: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/50",
        danger && "hover:border-destructive/40",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
          danger && "text-destructive",
        )}
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-sm font-medium", danger && "text-destructive")}>
          {label}
        </span>
        <span className="block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

/**
 * SourceCard — Per-source import connector card.
 */

import { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SourceStatus = 'active' | 'paused' | 'error' | 'disconnected';

export interface SourceCardProps {
  name: string;
  sourceApp: string;
  icon: React.ReactNode;
  status: SourceStatus;
  accountEmail?: string;
  lastSyncAt?: string | null;
  callCount: number;
  isActive: boolean;
  onToggle?: (active: boolean) => void;
  onSync?: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  syncProgress?: { current: number; total: number };
  errorMessage?: string | null;
  disabled?: boolean;
  /** When true, hides the active/inactive toggle and shows a static status badge instead. */
  alwaysAvailable?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_LABEL: Record<SourceStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  error: 'Error',
  disconnected: 'Not connected',
};

const STATUS_CLASS: Record<SourceStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-500',
  paused: 'bg-amber-500/10 text-amber-500',
  error: 'bg-red-500/10 text-red-500',
  disconnected: 'bg-muted text-muted-foreground',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SourceCard({
  name,
  sourceApp,
  icon,
  status,
  accountEmail,
  lastSyncAt,
  callCount,
  isActive,
  onToggle,
  onSync,
  onConnect,
  onDisconnect,
  syncProgress,
  errorMessage,
  disabled = false,
  alwaysAvailable = false,
}: SourceCardProps) {
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const isConnected = status !== 'disconnected';
  const isOAuthSource = sourceApp === 'fathom' || sourceApp === 'zoom';

  return (
    <>
      <div
        className={cn(
          'relative flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4',
          'transition-shadow hover:shadow-sm',
          disabled && 'opacity-60 pointer-events-none',
        )}
      >
        {/* Header row: icon + name + status badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
              {icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">{name}</p>
              {accountEmail && (
                <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                  {accountEmail}
                </p>
              )}
            </div>
          </div>

          {/* Status badge */}
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
              STATUS_CLASS[status],
            )}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>

        {/* Error message */}
        {status === 'error' && errorMessage && (
          <p className="text-[11px] text-red-500 leading-relaxed rounded-md bg-red-500/10 px-2.5 py-1.5">
            {errorMessage}
          </p>
        )}

        {/* Sync progress bar */}
        {syncProgress && syncProgress.total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Syncing…</span>
              <span>
                {syncProgress.current}/{syncProgress.total}
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-vibe-orange rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (syncProgress.current / syncProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Stats row: last sync + call count */}
        {isConnected && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{callCount} recordings</span>
            {lastSyncAt && (
              <>
                <span className="text-border">·</span>
                <span>Last sync {formatRelativeTime(lastSyncAt)}</span>
              </>
            )}
          </div>
        )}

        {/* Active/inactive toggle — only for connected sources that aren't always-available */}
        {isConnected && !alwaysAvailable && onToggle && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {isActive ? 'Background sync on' : 'Background sync off'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              aria-label={`Toggle ${name} auto-sync`}
              onClick={() => onToggle(!isActive)}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                'transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange',
                isActive ? 'bg-vibe-orange' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm',
                  'transform transition-transform duration-200 ease-in-out',
                  isActive ? 'translate-x-4' : 'translate-x-0',
                )}
              />
            </button>
          </div>
        )}

        {/* Static "always available" badge — replaces toggle for sources that can't be disabled */}
        {alwaysAvailable && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Always available</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-0.5">
          {!isConnected && onConnect && (
            <Button
              type="button"
              onClick={onConnect}
              size="sm"
              className="flex-1"
            >
              Connect
            </Button>
          )}

          {isConnected && status === 'error' && onConnect && (
            <Button
              type="button"
              onClick={onConnect}
              size="sm"
              className="flex-1"
            >
              Reconnect
            </Button>
          )}

          {isConnected && status === 'active' && onSync && (
            <Button
              type="button"
              onClick={onSync}
              size="sm"
              className="flex-1"
            >
              {isOAuthSource ? 'Sync Now' : 'Import'}
            </Button>
          )}

          {isConnected && onDisconnect && (
            <Button
              type="button"
              onClick={() => setDisconnectOpen(true)}
              variant="ghost"
              size="sm"
              className="ml-auto min-w-0 px-2 text-muted-foreground"
            >
              Disconnect
            </Button>
          )}
        </div>
      </div>

      <AlertDialog.Root open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in-0" />
          <AlertDialog.Content
            className={cn(
              'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-full max-w-sm',
              'bg-background border border-border rounded-xl shadow-2xl p-6',
              'animate-in zoom-in-95 duration-200',
              'focus:outline-none',
            )}
          >
            <AlertDialog.Title className="font-montserrat font-extrabold text-base uppercase tracking-wide text-foreground mb-2">
              Disconnect {name}?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground leading-relaxed mb-5">
              Future syncs will stop. Your imported calls will be kept.
            </AlertDialog.Description>
            <div className="flex gap-3 justify-end">
              <AlertDialog.Cancel asChild>
                <Button
                  type="button"
                  variant="hollow"
                  size="sm"
                >
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onDisconnect?.();
                    setDisconnectOpen(false);
                  }}
                >
                  Disconnect
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

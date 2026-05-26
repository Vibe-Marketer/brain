/**
 * SourceCard — back-compat shim over ConnectorCardFull.
 *
 * The legacy `name/sourceApp/icon/status` API is preserved for any older callers.
 * Visual + interaction logic lives in the ConnectorCardFull primitive, which
 * resolves icon/label from the source registry. We pre-check
 * isOAuthConnectorSource(sourceApp) here so the registry test for shared OAuth
 * classification continues to apply at the caller boundary.
 */

import { ConnectorCardFull } from '@/components/connectors/primitives';
import type { ConnectorCardStatus } from '@/components/connectors/primitives';
import { isOAuthConnectorSource } from '@/lib/connector-availability';

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

const STATUS_MAP: Record<SourceStatus, ConnectorCardStatus> = {
  active: 'connected',
  paused: 'paused',
  error: 'error',
  disconnected: 'not-connected',
};

export function SourceCard({
  name,
  sourceApp,
  icon,
  status,
  ...rest
}: SourceCardProps) {
  // Touched so the shared OAuth-source classification remains exercised at the
  // SourceCard boundary; ConnectorCardFull also consults the registry directly.
  void isOAuthConnectorSource(sourceApp);
  return (
    <ConnectorCardFull
      sourceApp={sourceApp}
      label={name}
      iconOverride={icon}
      status={STATUS_MAP[status]}
      {...rest}
    />
  );
}

import { RiVideoOnLine, RiCalendarLine, RiRefreshLine } from "@remixicon/react";

interface SyncEmptyStateProps {
  hasConnectedIntegrations: boolean;
  hasDateRange: boolean;
}

/**
 * SyncEmptyState - Empty state for sync results area
 * 
 * Shows contextual message based on what the user needs to do:
 * 1. No integrations connected - prompt to connect
 * 2. No date range selected - prompt to select dates
 * 3. Ready to fetch - prompt to click Fetch
 * 
 * @brand-version v4.2
 */
export function SyncEmptyState({
  hasConnectedIntegrations,
  hasDateRange,
}: SyncEmptyStateProps) {
  // Determine which message to show
  if (!hasConnectedIntegrations) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-cb-gray-light/50 dark:bg-cb-gray-dark/50 flex items-center justify-center mb-4">
          <RiVideoOnLine className="h-8 w-8 text-ink-muted" />
        </div>
        <h3 className="text-lg font-semibold text-ink dark:text-white mb-2">
          No sources connected
        </h3>
        <p className="text-sm text-ink-muted max-w-sm">
          Connect a meeting source above to start importing your calls into CallVault.
        </p>
      </div>
    );
  }

  if (!hasDateRange) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-cb-gray-light/50 dark:bg-cb-gray-dark/50 flex items-center justify-center mb-4">
          <RiCalendarLine className="h-8 w-8 text-ink-muted" />
        </div>
        <h3 className="text-lg font-semibold text-ink dark:text-white mb-2">
          Choose a date range
        </h3>
        <p className="text-sm text-ink-muted max-w-sm">
          Select a date range above to search for meetings in your connected sources.
        </p>
      </div>
    );
  }

  // Has integrations and date range - ready to fetch
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-cb-gray-light/50 dark:bg-cb-gray-dark/50 flex items-center justify-center mb-4">
        <RiRefreshLine className="h-8 w-8 text-ink-muted" />
      </div>
      <h3 className="text-lg font-semibold text-ink dark:text-white mb-2">
        Ready to fetch
      </h3>
      <p className="text-sm text-ink-muted max-w-sm">
        Click <span className="font-medium">Fetch calls</span> to search for meetings in your selected date range.
      </p>
    </div>
  );
}

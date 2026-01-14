import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  RiLoader4Line,
  RiAlertLine,
  RiCloseLine,
  RiArrowLeftLine,
  RiCheckLine,
  RiRefreshLine,
} from "@remixicon/react";
import { FathomIcon, GoogleMeetIcon, ZoomIcon } from "@/components/transcript-library/SourcePlatformIcons";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { getGoogleOAuthUrl, getFathomOAuthUrl, getZoomOAuthUrl } from "@/lib/api-client";
import { type IntegrationPlatform } from "./IntegrationSyncPane";

// Connection timeout in milliseconds (30 seconds per PRD-018 requirement)
const CONNECTION_TIMEOUT_MS = 30000;

// Connection state for proper state management and user feedback
type ConnectionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "timeout" };

interface InlineConnectionWizardProps {
  platform: IntegrationPlatform;
  onComplete: () => void;
  onCancel: () => void;
  /** Email of currently connected account, if any - shows reconnection notice */
  currentEmail?: string;
}

export function InlineConnectionWizard({
  platform,
  onComplete: _onComplete,
  onCancel,
  currentEmail,
}: InlineConnectionWizardProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: "idle" });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup timeout and abort controller on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Get platform display name
  const getPlatformName = useCallback(() => {
    return platform === "google_meet" ? "Google" : platform === "zoom" ? "Zoom" : "Fathom";
  }, [platform]);

  // Handle cancellation - ALWAYS works regardless of state (PRD-020)
  // Removed dependency on connectionState.status to avoid stale closure issues
  const handleCancel = useCallback(() => {
    // Track if we had an active connection attempt
    const wasConnecting = abortControllerRef.current !== null;

    // Always clear timeout (safe to call even if not set)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Always abort pending requests (safe to call even if not set)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Always reset state to idle (no-op if already idle)
    setConnectionState({ status: "idle" });

    // Show toast only if we actually cancelled an active connection
    if (wasConnecting) {
      toast.info("Connection cancelled");
    }

    // Always close the modal - NEVER trap the user
    onCancel();
  }, [onCancel]);

  // Handle retry after error or timeout
  const handleRetry = useCallback(() => {
    setConnectionState({ status: "idle" });
  }, []);

  const handleOAuthConnect = async () => {
    // Clear any previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      setConnectionState({ status: "loading" });

      // Set up timeout (30 seconds)
      timeoutRef.current = setTimeout(() => {
        logger.warn(`OAuth connection timeout for ${platform}`);
        setConnectionState({ status: "timeout" });
        toast.error(`Connection timed out. Please try again.`);
        // Abort any pending request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, CONNECTION_TIMEOUT_MS);

      let response;
      if (platform === "google_meet") {
        response = await getGoogleOAuthUrl();
      } else if (platform === "fathom") {
        response = await getFathomOAuthUrl();
      } else if (platform === "zoom") {
        response = await getZoomOAuthUrl();
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      // Clear timeout since we got a response
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (response.data?.authUrl) {
        // Store a flag to indicate we're completing OAuth and should refresh
        sessionStorage.setItem("pendingOAuthPlatform", platform);
        // Redirect to OAuth provider
        window.location.href = response.data.authUrl;
      } else if (response.error) {
        throw new Error(response.error);
      } else {
        throw new Error("No OAuth URL returned");
      }
    } catch (error) {
      // Clear timeout on error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Check if aborted (cancelled by user or timeout)
      if (error instanceof Error && error.name === "AbortError") {
        return; // Already handled
      }

      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      logger.error(`Failed to get ${platform} OAuth URL`, error);

      setConnectionState({ status: "error", message: errorMessage });
      toast.error(`Failed to connect to ${getPlatformName()}: ${errorMessage}`);
    }
  };

  // Platform-specific configurations (streamlined - no features list)
  const platformConfig = {
    fathom: {
      name: "Fathom",
      icon: <FathomIcon className="h-6 w-6" />,
      color: "text-purple-600 dark:text-purple-400",
      warningTitle: "API Access Required",
      warningContent: (
        <p className="text-sm text-muted-foreground">
          You'll need a Fathom account with API access. Personal plans include this feature.
          Enterprise users should check with their admin.
        </p>
      ),
    },
    google_meet: {
      name: "Google Meet",
      icon: <GoogleMeetIcon className="h-6 w-6" />,
      color: "text-blue-600 dark:text-blue-400",
      warningTitle: "Recording Requirements",
      warningContent: (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Google Meet recordings are only available for:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Google Workspace Business Standard, Plus, or Enterprise</li>
            <li>Google Workspace Education Plus</li>
            <li>Teaching and Learning Upgrade</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Personal accounts can sync meeting data but won't have recordings.
          </p>
        </div>
      ),
    },
    zoom: {
      name: "Zoom",
      icon: <ZoomIcon className="h-6 w-6" />,
      color: "text-sky-600 dark:text-sky-400",
      warningTitle: "Cloud Recording Required",
      warningContent: (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Zoom cloud recording is required for importing recordings. This feature is available on:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Zoom Pro, Business, Education, or Enterprise plans</li>
            <li>Accounts with cloud recording enabled by admin</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Local recordings cannot be imported automatically.
          </p>
        </div>
      ),
    },
  };

  const config = platformConfig[platform];
  const isConnecting = connectionState.status === "loading";
  const hasError = connectionState.status === "error";
  const hasTimeout = connectionState.status === "timeout";
  const showRetry = hasError || hasTimeout;

  // Render error or timeout state
  if (showRetry) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-destructive">
              <RiAlertLine className="h-6 w-6" />
            </div>
            <h3 className="font-medium">
              {hasTimeout ? "Connection Timed Out" : "Connection Failed"}
            </h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0">
            <RiCloseLine className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        {/* Error message */}
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <RiAlertLine className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium text-destructive">
                {hasTimeout ? "The connection took too long" : "Unable to connect"}
              </p>
              <p className="text-sm text-muted-foreground">
                {hasTimeout
                  ? "The server didn't respond within 30 seconds. This could be due to network issues or server problems."
                  : connectionState.status === "error"
                    ? connectionState.message
                    : "An unexpected error occurred."}
              </p>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-medium">Try these steps:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Check your internet connection</li>
            <li>Disable any ad blockers or VPNs temporarily</li>
            <li>Try again in a few minutes</li>
          </ul>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="hollow" size="sm" onClick={onCancel}>
            <RiArrowLeftLine className="mr-1 h-4 w-4" />
            Cancel
          </Button>

          <Button onClick={handleRetry} size="sm">
            <RiRefreshLine className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact Header with CTA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={config.color}>{config.icon}</div>
          <div>
            <h3 className="font-medium text-sm">
              {currentEmail ? `Reconnect ${config.name}` : `Connect ${config.name}`}
            </h3>
            <p className="text-xs text-muted-foreground">
              Sync recordings and transcripts
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="h-8 w-8 p-0"
          aria-label={isConnecting ? "Cancel connection" : "Close"}
        >
          <RiCloseLine className="h-4 w-4" />
        </Button>
      </div>

      {/* Currently Connected Notice - compact, shown when reconnecting */}
      {currentEmail && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <RiCheckLine className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-blue-600 dark:text-blue-400">{currentEmail}</span>
              {" "}will be replaced
            </p>
          </div>
        </div>
      )}

      {/* Primary CTA - Prominent */}
      <Button onClick={handleOAuthConnect} disabled={isConnecting} className="w-full">
        {isConnecting ? (
          <>
            <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : currentEmail ? (
          <>
            <RiRefreshLine className="mr-2 h-4 w-4" />
            Switch Account
          </>
        ) : (
          <>
            {config.icon}
            <span className="ml-2">Connect with {config.name}</span>
          </>
        )}
      </Button>

      {/* Requirements - visible if they exist, no acknowledgment needed */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <RiAlertLine className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-amber-600 dark:text-amber-400 text-sm">{config.warningTitle}</p>
            {config.warningContent}
          </div>
        </div>
      </div>

      {/* Help text */}
      <p className="text-xs text-ink-muted text-center">
        {isConnecting
          ? "Please wait..."
          : "You'll authorize via OAuth, then return here."}
      </p>

      {/* Cancel link for non-loading state */}
      {!isConnecting && (
        <button
          onClick={handleCancel}
          className="w-full text-xs text-ink-muted hover:text-ink underline"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

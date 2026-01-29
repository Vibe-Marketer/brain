import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { RiLoader4Line, RiCheckLine, RiCloseLine } from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { completeFathomOAuth, completeGoogleOAuth } from "@/lib/api-client";
import { completeZoomOAuth } from "@/lib/zoom-api-client";

type CallbackState = "loading" | "success" | "error";

/**
 * OAuthCallback handles OAuth redirects from external providers
 *
 * Routes:
 *   /oauth/callback/ - Fathom OAuth callback
 *   /oauth/callback/meet - Google Meet OAuth callback
 *   /oauth/callback/zoom - Zoom OAuth callback
 *
 * Process:
 * 1. Extract code and state from URL params
 * 2. Determine provider from path
 * 3. Call appropriate backend callback function
 * 4. Redirect to settings on success
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<CallbackState>("loading");
  const [message, setMessage] = useState("Processing OAuth callback...");

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Extract code and state from URL params
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const stateParam = params.get("state");
        const error = params.get("error");
        const errorDescription = params.get("error_description");

        // Check for OAuth errors from provider
        if (error) {
          logger.error("OAuth error from provider", { error, errorDescription });
          throw new Error(errorDescription || error || "OAuth authorization failed");
        }

        if (!code || !stateParam) {
          throw new Error("Missing required OAuth parameters (code or state)");
        }

        // Determine provider from path
        const isGoogleCallback = location.pathname.includes("/meet");
        const isZoomCallback = location.pathname.includes("/zoom");
        const provider = isGoogleCallback ? "Google Meet" : isZoomCallback ? "Zoom" : "Fathom";

        setMessage(`Completing ${provider} connection...`);
        logger.info(`Processing ${provider} OAuth callback`);

        // Call appropriate backend callback
        let response;
        if (isGoogleCallback) {
          response = await completeGoogleOAuth(code, stateParam);
        } else if (isZoomCallback) {
          response = await completeZoomOAuth(code, stateParam);
        } else {
          response = await completeFathomOAuth(code, stateParam);
        }

        if (response.error) {
          throw new Error(response.error);
        }

        // Success!
        setState("success");
        setMessage(`Successfully connected to ${provider}!`);
        toast.success(`Successfully connected to ${provider}!`);

        // Redirect to Sync tab after a brief delay
        setTimeout(() => {
          navigate("/?tab=sync", { replace: true });
        }, 1500);

      } catch (error) {
        logger.error("OAuth callback error", error);
        setState("error");
        const errorMessage = error instanceof Error ? error.message : "OAuth callback failed";
        setMessage(errorMessage);
        toast.error(errorMessage);

        // Redirect to Sync tab after error display
        setTimeout(() => {
          navigate("/?tab=sync", { replace: true });
        }, 3000);
      }
    };

    processCallback();
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8 max-w-md">
        {/* Status Icon */}
        <div className="flex justify-center">
          {state === "loading" && (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <RiLoader4Line className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}
          {state === "success" && (
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <RiCheckLine className="w-8 h-8 text-green-500" />
            </div>
          )}
          {state === "error" && (
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <RiCloseLine className="w-8 h-8 text-destructive" />
            </div>
          )}
        </div>

        {/* Status Message */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">
            {state === "loading" && "Connecting..."}
            {state === "success" && "Connected!"}
            {state === "error" && "Connection Failed"}
          </h1>
          <p className="text-muted-foreground">{message}</p>
        </div>

        {/* Redirect notice */}
        {(state === "success" || state === "error") && (
          <p className="text-sm text-muted-foreground">
            Redirecting to settings...
          </p>
        )}
      </div>
    </div>
  );
}

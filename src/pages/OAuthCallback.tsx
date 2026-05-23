import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { RiLoader4Line, RiCheckLine, RiCloseLine } from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { completeFathomOAuth, completePlaudOAuth, completeZoomOAuth } from "@/lib/api-client";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";

type CallbackState = "loading" | "success" | "error";

/**
 * OAuthCallback handles OAuth redirects from external providers
 *
 * Routes:
 *   /oauth/callback/ - Fathom OAuth callback
 *   /oauth/callback/zoom - Zoom OAuth callback
 *   /oauth/callback/plaud - Plaud OAuth callback
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
          logger.error("OAuth error from provider", {
            error,
            errorDescription,
          });
          throw new Error(
            errorDescription || error || "OAuth authorization failed",
          );
        }

        if (!code || !stateParam) {
          throw new Error("Missing required OAuth parameters (code or state)");
        }

        // Determine provider from path
        const isZoomCallback = location.pathname.includes("/zoom");
        const isPlaudCallback = location.pathname.includes("/plaud");
        const provider = isZoomCallback ? "Zoom" : isPlaudCallback ? "Plaud" : "Fathom";

        setMessage(`Completing ${provider} connection...`);
        logger.info(`Processing ${provider} OAuth callback`);

        // Call appropriate backend callback
        let response;
        if (isZoomCallback) {
          response = await completeZoomOAuth(code, stateParam);
        } else if (isPlaudCallback) {
          response = await completePlaudOAuth(code, stateParam);
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

        // Extract sourceId and accountEmail from callback response
        const connectedSourceId = response.data?.sourceId;
        const connectedEmail = response.data?.accountEmail;

        // Check if onboarding is incomplete — if so, route to setup wizard
        const sourceParam = isZoomCallback ? "zoom" : isPlaudCallback ? "plaud" : "fathom";
        const extraParams = [
          connectedSourceId ? `sourceId=${connectedSourceId}` : "",
          connectedEmail ? `email=${encodeURIComponent(connectedEmail)}` : "",
        ]
          .filter(Boolean)
          .join("&");
        // If OAuth was initiated from a non-Import surface (e.g. Settings),
        // InlineConnectionWizard stored the originating pathname. Return there
        // instead of forcing /import. Always clear after read.
        const oauthReturnTo = localStorage.getItem("oauthReturnTo");
        localStorage.removeItem("oauthReturnTo");
        // Validate same-origin relative path (must start with / but not //)
        const safeReturnTo =
          oauthReturnTo && /^\/[^/]/.test(oauthReturnTo) ? oauthReturnTo : null;
        const queryString = `?source=${sourceParam}&connected=true${extraParams ? "&" + extraParams : ""}`;
        let redirectTo = safeReturnTo
          ? `${safeReturnTo}${queryString}`
          : `/import${queryString}`;

        try {
          const { user } = await getSafeUser();
          if (user) {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("onboarding_completed")
              .eq("user_id", user.id)
              .maybeSingle();

            if (!profile?.onboarding_completed) {
              redirectTo = `/setup?source=${sourceParam}&connected=true`;
            }
          }
        } catch {
          // If profile check fails, default to import page
        }

        setTimeout(() => {
          navigate(redirectTo, { replace: true });
        }, 1500);
      } catch (error) {
        logger.error("OAuth callback error", error);
        setState("error");
        const errorMessage =
          error instanceof Error ? error.message : "OAuth callback failed";
        setMessage(errorMessage);
        toast.error(errorMessage);

        // Redirect to Import page after error display
        setTimeout(() => {
          navigate("/import", { replace: true });
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
            Redirecting to Import...
          </p>
        )}
      </div>
    </div>
  );
}

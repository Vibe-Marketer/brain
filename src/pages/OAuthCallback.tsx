import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { RiLoader4Line, RiCheckLine, RiCloseLine } from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { resolveOAuthCallbackRoute } from "@/lib/oauth-callback-routing";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";

type CallbackState = "loading" | "success" | "error";

/**
 * OAuthCallback handles OAuth redirects from external providers
 *
 * Routes:
 *   /oauth/callback - Fathom OAuth callback
 *   /oauth/callback/zoom - Zoom OAuth callback
 *   /oauth/callback/plaud - dormant Plaud OAuth callback scaffold
 *   /oauth/callback/read-ai - Read.ai OAuth callback
 *   /oauth/callback/grain - Grain OAuth callback
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
  // Track pending redirect timers so unmount mid-delay doesn't fire navigate()
  // on a freed component (React strict-mode double-mount + slow OAuth flow).
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleRedirect = (path: string, delayMs: number) => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = setTimeout(() => {
        redirectTimerRef.current = null;
        navigate(path, { replace: true });
      }, delayMs);
    };

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

        const route = resolveOAuthCallbackRoute(location.pathname);
        const provider = route.label;

        setMessage(`Completing ${provider} connection...`);
        logger.info(`Processing ${provider} OAuth callback`);

        const response = await route.completeOAuth(code, stateParam);

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
        const sourceParam = route.sourceApp;
        // If OAuth was initiated from a non-Import surface, return there using
        // the state-keyed entry created when the OAuth URL was issued.
        const safeReturnTo = getSafeReturnTo(readOAuthReturnTo(stateParam));
        let redirectTo = safeReturnTo
          ? appendConnectionParams(safeReturnTo, {
              source: sourceParam,
              sourceId: connectedSourceId,
              email: connectedEmail,
            })
          : appendConnectionParams("/import", {
              source: sourceParam,
              sourceId: connectedSourceId,
              email: connectedEmail,
            });

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

        scheduleRedirect(redirectTo, 1500);
      } catch (error) {
        logger.error("OAuth callback error", error);
        setState("error");
        const errorMessage =
          error instanceof Error ? error.message : "OAuth callback failed";
        setMessage(errorMessage);
        toast.error(errorMessage);

        // Redirect to Import page after error display
        scheduleRedirect("/import", 3000);
      }
    };

    processCallback();

    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
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

function readOAuthReturnTo(state: string): string | null {
  const stateKey = `oauthReturnTo:${state}`;
  const keyedReturnTo = localStorage.getItem(stateKey);
  if (keyedReturnTo) {
    localStorage.removeItem(stateKey);
    return keyedReturnTo;
  }

  const legacyReturnTo = localStorage.getItem("oauthReturnTo");
  localStorage.removeItem("oauthReturnTo");
  return legacyReturnTo;
}

function getSafeReturnTo(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const allowedRoute = ["/import", "/settings", "/setup"].some(
      (route) => url.pathname === route || url.pathname.startsWith(`${route}/`),
    );
    if (!allowedRoute) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function appendConnectionParams(
  path: string,
  params: {
    source: string;
    sourceId?: string | null;
    email?: string | null;
  },
): string {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("source", params.source);
  url.searchParams.set("connected", "true");
  if (params.sourceId) url.searchParams.set("sourceId", params.sourceId);
  if (params.email) url.searchParams.set("email", params.email);
  return `${url.pathname}${url.search}${url.hash}`;
}

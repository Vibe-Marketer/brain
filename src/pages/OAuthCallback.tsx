import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RiLoader2Line, RiCheckLine, RiErrorWarningLine } from "@remixicon/react";
import { completeFathomOAuth } from "@/lib/api-client";
import { completeZoomOAuth } from "@/lib/zoom-api-client";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

type CallbackStatus = "loading" | "success" | "error";
type Provider = "fathom" | "zoom" | "unknown";

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [provider, setProvider] = useState<Provider>("unknown");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (!code || !state) {
        setStatus("error");
        setErrorMessage("Missing authorization code or state parameter");
        return;
      }

      try {
        // Check if user is authenticated
        const { user, error: authError } = await getSafeUser();

        if (authError || !user) {
          // User needs to log in first - save callback params to localStorage and redirect
          logger.warn("User not authenticated for OAuth callback, redirecting to login");
          localStorage.setItem("oauth_callback_code", code);
          localStorage.setItem("oauth_callback_state", state);
          navigate("/login");
          return;
        }

        // Determine which provider by checking which state matches
        const { data: settings } = await supabase
          .from("user_settings")
          .select("oauth_state, zoom_oauth_state")
          .eq("user_id", user.id)
          .maybeSingle();

        let detectedProvider: Provider = "unknown";

        if (settings?.oauth_state === state) {
          detectedProvider = "fathom";
        } else if (settings?.zoom_oauth_state === state) {
          detectedProvider = "zoom";
        }

        setProvider(detectedProvider);

        if (detectedProvider === "unknown") {
          setStatus("error");
          setErrorMessage("Invalid state parameter. OAuth session may have expired. Please try connecting again.");
          return;
        }

        // Call the appropriate callback edge function
        if (detectedProvider === "fathom") {
          const response = await completeFathomOAuth(code, state);
          if (response.error) {
            throw new Error(response.error);
          }
          setStatus("success");
          toast.success("Successfully connected to Fathom!");
        } else if (detectedProvider === "zoom") {
          const response = await completeZoomOAuth(code, state);
          if (response.error) {
            throw new Error(response.error);
          }
          setStatus("success");
          toast.success("Successfully connected to Zoom!");
        }

        // Redirect to settings/integrations after a brief delay
        setTimeout(() => {
          navigate("/settings/integrations");
        }, 1500);

      } catch (error) {
        logger.error("OAuth callback error:", error);
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to complete authorization");
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  // Handle pending OAuth callback after login
  useEffect(() => {
    const savedCode = localStorage.getItem("oauth_callback_code");
    const savedState = localStorage.getItem("oauth_callback_state");

    if (savedCode && savedState) {
      // Clear saved values
      localStorage.removeItem("oauth_callback_code");
      localStorage.removeItem("oauth_callback_state");

      // If we're not already processing these params, add them to the URL
      const currentCode = searchParams.get("code");
      const currentState = searchParams.get("state");

      if (!currentCode && !currentState) {
        navigate(`/oauth/callback?code=${encodeURIComponent(savedCode)}&state=${encodeURIComponent(savedState)}`);
      }
    }
  }, [searchParams, navigate]);

  const providerName = provider === "fathom" ? "Fathom" : provider === "zoom" ? "Zoom" : "Provider";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <img src="/cv-play-button.svg" alt="CallVault" className="h-16 w-auto" />
        </div>

        {/* Status Icon */}
        <div className="flex justify-center">
          {status === "loading" && (
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <RiLoader2Line className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {status === "success" && (
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <RiCheckLine className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          )}
          {status === "error" && (
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <RiErrorWarningLine className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          )}
        </div>

        {/* Status Message */}
        <div className="space-y-2">
          {status === "loading" && (
            <>
              <h2 className="text-xl font-semibold">Completing Authorization</h2>
              <p className="text-muted-foreground">
                {provider !== "unknown"
                  ? `Connecting to ${providerName}...`
                  : "Verifying your authorization..."}
              </p>
            </>
          )}
          {status === "success" && (
            <>
              <h2 className="text-xl font-semibold text-green-600 dark:text-green-400">
                Successfully Connected!
              </h2>
              <p className="text-muted-foreground">
                Your {providerName} account has been connected. Redirecting to settings...
              </p>
            </>
          )}
          {status === "error" && (
            <>
              <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">
                Connection Failed
              </h2>
              <p className="text-muted-foreground">
                {errorMessage}
              </p>
              <button
                onClick={() => navigate("/settings/integrations")}
                className="mt-4 text-primary hover:underline"
              >
                Return to Settings
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * OAuthConsentPage - OAuth 2.1 consent screen for MCP client authorization
 *
 * Shown when Supabase redirects users to /oauth/consent?authorization_id=<id>
 * during the MCP OAuth 2.1 flow. Lets the user approve or deny access for
 * the requesting application (Claude Desktop, Cursor, etc.).
 *
 * @brand-version v4.2
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RiShieldCheckLine,
  RiErrorWarningLine,
  RiCheckLine,
  RiMailLine,
  RiUserLine,
  RiTimeLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Scope display names for the consent screen
const SCOPE_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
  openid: {
    icon: <RiShieldCheckLine className="h-4 w-4 text-muted-foreground" />,
    label: 'Verify your identity',
  },
  email: {
    icon: <RiMailLine className="h-4 w-4 text-muted-foreground" />,
    label: 'View your email address',
  },
  profile: {
    icon: <RiUserLine className="h-4 w-4 text-muted-foreground" />,
    label: 'View your profile information',
  },
};

interface AuthorizationDetails {
  client: {
    name: string;
  };
  scope: string;
  redirect_uri: string;
}

type PageState =
  | 'loading'
  | 'error-no-id'
  | 'error-expired'
  | 'error-fetch'
  | 'error-action'
  | 'consent'
  | 'approving'
  | 'denying';

export default function OAuthConsentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const authorizationId = searchParams.get('authorization_id');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [authDetails, setAuthDetails] = useState<AuthorizationDetails | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchAuthorizationDetails = useCallback(async () => {
    if (!authorizationId) return;

    try {
      // supabase.auth.oauth is available in supabase-js v2 with OAuth server support
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.auth as any).oauth.getAuthorizationDetails(
        authorizationId
      );

      if (error) {
        // Check if it's an expiry error
        const errMsg = String(error?.message || error).toLowerCase();
        if (errMsg.includes('expired') || errMsg.includes('not found')) {
          setPageState('error-expired');
        } else {
          setPageState('error-fetch');
        }
        return;
      }

      setAuthDetails(data);
      setPageState('consent');
    } catch {
      setPageState('error-fetch');
    }
  }, [authorizationId]);

  useEffect(() => {
    // Wait for auth state to resolve
    if (authLoading) return;

    // Missing authorization_id — show error immediately
    if (!authorizationId) {
      setPageState('error-no-id');
      return;
    }

    // Not authenticated — redirect to login, preserving authorization_id
    if (!user) {
      const returnTo = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
      navigate(`/login?next=${encodeURIComponent(returnTo)}`);
      return;
    }

    // Authenticated — fetch authorization details
    fetchAuthorizationDetails();
  }, [authLoading, user, authorizationId, navigate, fetchAuthorizationDetails]);

  const handleApprove = async () => {
    if (!authorizationId) return;
    setPageState('approving');
    setActionError(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.auth as any).oauth.approveAuthorization(
        authorizationId
      );

      if (error) throw error;

      window.location.href = data.redirect_to;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to approve authorization';
      setActionError(errMsg);
      setPageState('error-action');
    }
  };

  const handleDeny = async () => {
    if (!authorizationId) return;
    setPageState('denying');
    setActionError(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.auth as any).oauth.denyAuthorization(
        authorizationId
      );

      if (error) throw error;

      window.location.href = data.redirect_to;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to deny authorization';
      setActionError(errMsg);
      setPageState('error-action');
    }
  };

  const isActionInProgress = pageState === 'approving' || pageState === 'denying';

  // --- Loading state ---
  if (pageState === 'loading' || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-inter font-light text-sm">
            Loading authorization request...
          </p>
        </div>
      </div>
    );
  }

  // --- Error: missing authorization_id ---
  if (pageState === 'error-no-id') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <RiErrorWarningLine className="w-12 h-12 text-destructive" />
            </div>
            <h2 className="font-montserrat font-extrabold text-lg uppercase tracking-wide">
              Invalid Request
            </h2>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground font-inter font-light">
              Invalid authorization request. Please try connecting again from your MCP client.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Error: expired authorization ---
  if (pageState === 'error-expired') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <RiTimeLine className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="font-montserrat font-extrabold text-lg uppercase tracking-wide">
              Authorization Expired
            </h2>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground font-inter font-light">
              This authorization request has expired. Please try connecting again from your MCP
              client.
            </p>
            <p className="text-xs text-muted-foreground">
              Authorization requests expire after 10 minutes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Error: fetch or action failure ---
  if (pageState === 'error-fetch' || pageState === 'error-action') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <RiErrorWarningLine className="w-12 h-12 text-destructive" />
            </div>
            <h2 className="font-montserrat font-extrabold text-lg uppercase tracking-wide">
              Something Went Wrong
            </h2>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground font-inter font-light">
              {actionError ||
                'Failed to load the authorization request. Please try connecting again from your MCP client.'}
            </p>
            {pageState === 'error-fetch' && (
              <Button
                variant="hollow"
                onClick={fetchAuthorizationDetails}
                className="w-full"
              >
                Try Again
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Consent screen ---
  const appName = authDetails?.client?.name || 'An application';
  const scopes = authDetails?.scope?.split(' ').filter(Boolean) ?? [];
  const knownScopes = scopes.filter((s) => s in SCOPE_LABELS);
  const unknownScopes = scopes.filter((s) => !(s in SCOPE_LABELS));

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          {/* CallVault branding */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <RiShieldCheckLine className="w-7 h-7 text-primary" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">
              Authorization Request
            </p>
            <h2 className="font-montserrat font-extrabold text-xl">
              <span className="text-foreground">{appName}</span>
            </h2>
            <p className="text-sm text-muted-foreground font-inter font-light">
              wants to access your CallVault account
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Permissions section */}
          {(knownScopes.length > 0 || unknownScopes.length > 0) && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wide">
                Permissions Requested
              </p>
              <ul className="space-y-2.5">
                {knownScopes.map((scope) => {
                  const { icon, label } = SCOPE_LABELS[scope];
                  return (
                    <li key={scope} className="flex items-center gap-2.5">
                      {icon}
                      <span className="text-sm font-inter font-light text-foreground">
                        {label}
                      </span>
                    </li>
                  );
                })}
                {unknownScopes.map((scope) => (
                  <li key={scope} className="flex items-center gap-2.5">
                    <RiCheckLine className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-inter font-light text-foreground">{scope}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data access notice */}
          <p className="text-xs text-muted-foreground font-inter font-light leading-relaxed">
            This will allow{' '}
            <span className="font-medium text-foreground">{appName}</span> to read
            your call recordings, transcripts, and contacts on your behalf.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 pt-1">
            <Button
              onClick={handleApprove}
              disabled={isActionInProgress}
              className="w-full"
            >
              {pageState === 'approving' ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Allowing...
                </>
              ) : (
                <>
                  <RiCheckLine className="w-4 h-4 mr-2" />
                  Allow
                </>
              )}
            </Button>
            <Button
              variant="hollow"
              onClick={handleDeny}
              disabled={isActionInProgress}
              className="w-full"
            >
              {pageState === 'denying' ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Denying...
                </>
              ) : (
                'Deny'
              )}
            </Button>
          </div>

          {/* Security note */}
          <p className="text-xs text-center text-muted-foreground font-inter font-light">
            You can revoke this access at any time from your CallVault settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

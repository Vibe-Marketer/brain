/**
 * SharedCallView
 *
 * State-machine orchestrator for /s/:token. Renders, in order:
 * - Spinner while data.status === 'loading'
 * - PublicShareLanding when unauthenticated → status === 'public-view'
 * - WrongAccountState when authenticated as wrong recipient → status === 'wrong-recipient'
 * - Existing call view (banner + header + transcript) when status === 'ok'
 * - "Link revoked" card when status === 'revoked'
 * - "Call not found" card when status === 'not-found'
 * - "Couldn't load the call" card when status === 'error'
 *
 * Phase 32: removed unconditional navigate('/login') redirect — recipients
 * see the public landing first, not a bare sign-in wall.
 */

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  RiLinksLine,
  RiTimeLine,
  RiUserLine,
  RiFileTextLine,
  RiErrorWarningLine,
  RiLockLine,
  RiArrowLeftLine,
  RiCalendarLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/AuthContext';
import { useSharedCall } from '@/hooks/useSharing';
import { supabase } from '@/integrations/supabase/client';
import { PublicShareLanding } from '@/components/share/PublicShareLanding';
import { WrongAccountState } from '@/components/share/WrongAccountState';

export const SharedCallView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const { data, refetch } = useSharedCall({
    token: token || null,
    userId: user?.id,
  });

  // Authentication context still resolving — show spinner.
  if (authLoading || data.status === 'loading') {
    return (
      <div className="min-h-screen bg-viewport flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Loading shared call...</p>
        </div>
      </div>
    );
  }

  // Public landing — unauthenticated visitor.
  if (data.status === 'public-view') {
    const handleSignUp = () => {
      if (token) sessionStorage.setItem('pendingShareToken', token);
      navigate(`/login?signup=true&share=${token}`);
    };
    const handleOpenExisting = () => {
      if (token) sessionStorage.setItem('pendingShareToken', token);
      navigate(`/login?share=${token}`);
    };
    return (
      <PublicShareLanding
        inviterName={data.inviter_name}
        callTitle={data.call_title}
        token={token!}
        onSignUp={handleSignUp}
        onOpenExisting={handleOpenExisting}
      />
    );
  }

  // Wrong-account state — authenticated but email doesn't match the share recipient.
  if (data.status === 'wrong-recipient') {
    const handleSignOut = async () => {
      setIsSigningOut(true);
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        navigate(`/s/${token}`); // Land on the public landing (now unauthenticated).
      } catch {
        toast.error("Couldn't sign out. Refresh and try again.");
        setIsSigningOut(false);
      }
    };
    const handleCancel = () => navigate('/');
    return (
      <WrongAccountState
        recipientMasked={data.recipient_masked}
        onSignOut={handleSignOut}
        onCancel={handleCancel}
        isSigningOut={isSigningOut}
      />
    );
  }

  // Revoked link state.
  if (data.status === 'revoked') {
    return (
      <div className="min-h-screen bg-viewport flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <RiLockLine className="w-16 h-16 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Link revoked</h2>
          <p className="text-muted-foreground mb-6">
            This share link has been revoked by the owner. You no longer have access to this call.
          </p>
          <Button onClick={() => navigate('/')} variant="hollow">
            <RiArrowLeftLine className="w-4 h-4 mr-2" />
            Go home
          </Button>
        </div>
      </div>
    );
  }

  // 404 — token invalid or expired.
  if (data.status === 'not-found') {
    return (
      <div className="min-h-screen bg-viewport flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <RiLinksLine className="w-16 h-16 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Call not found</h2>
          <p className="text-muted-foreground mb-6">
            This share link is invalid or has expired. Check the link or ask the sender to re-share.
          </p>
          <Button onClick={() => navigate('/')} variant="hollow">
            <RiArrowLeftLine className="w-4 h-4 mr-2" />
            Go home
          </Button>
        </div>
      </div>
    );
  }

  // 5xx / network failure.
  if (data.status === 'error') {
    return (
      <div className="min-h-screen bg-viewport flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <RiErrorWarningLine
            className="w-16 h-16 text-destructive mx-auto mb-4"
            aria-hidden="true"
          />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Couldn&rsquo;t load the call
          </h2>
          <p className="text-muted-foreground mb-6">
            Something went wrong loading this shared call. Try refreshing — if it keeps failing,
            ask the sender to re-share.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              onClick={() => refetch()}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Try again
            </Button>
            <Button onClick={() => navigate('/')} variant="hollow">
              <RiArrowLeftLine className="w-4 h-4 mr-2" />
              Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // status === 'ok' — render the existing call view (banner + header + transcript).
  const { call, shareLink } = data;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatDuration = (duration: string | null) => duration ?? null;

  return (
    <div className="min-h-screen bg-viewport">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Shared Call Banner — tokens sanitized off bg-info-bg / border-info-border / text-info-text */}
        <div className="mb-6 p-4 bg-muted/40 rounded-lg border border-border flex items-center gap-3">
          <RiLinksLine
            className="w-5 h-5 text-muted-foreground flex-shrink-0"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              Shared call from{' '}
              <span className="font-medium text-foreground">{call.recorded_by_email}</span>
            </p>
          </div>
          <Badge variant="outline" className="text-foreground border-border">
            <RiLinksLine className="w-3 h-3 mr-1" aria-hidden="true" />
            SHARED
          </Badge>
        </div>

        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <RiArrowLeftLine className="w-4 h-4 mr-1" />
            Back to Home
          </Link>

          <h1 className="text-3xl font-bold text-foreground mb-4">
            {call.call_name || 'Untitled Call'}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <RiCalendarLine className="w-4 h-4" />
              <span>{formatDate(call.recording_start_time)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <RiTimeLine className="w-4 h-4" />
              <span>{formatTime(call.recording_start_time)}</span>
            </div>
            {call.duration && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">•</span>
                <span>{formatDuration(call.duration)}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <RiUserLine className="w-4 h-4" />
              <span>{call.recorded_by_email}</span>
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <RiFileTextLine className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Transcript</h2>
          </div>
          <div className="p-6">
            {call.full_transcript ? (
              <pre className="whitespace-pre-wrap font-sans text-foreground text-sm leading-relaxed">
                {call.full_transcript}
              </pre>
            ) : (
              <div className="text-center py-12">
                <RiFileTextLine className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No transcript available for this call</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Shared on {shareLink && formatDate(shareLink.created_at)}
            {shareLink?.recipient_email && <span> with {shareLink.recipient_email}</span>}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharedCallView;

/**
 * SharedCallView
 *
 * Read-only view of a call accessed via a share link
 * Features:
 * - Token-based access via /s/:token route
 * - Read-only display of transcript and call details
 * - Access logging for audit trail
 * - Revoked link error handling
 */

import React, { useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useSharedCall } from '@/hooks/useSharing';
import { cn } from '@/lib/utils';

export const SharedCallView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [accessLogged, setAccessLogged] = useState(false);

  // Fetch shared call data
  const { data, isLoading, error, logAccess } = useSharedCall({
    token: token || null,
    userId: user?.id,
  });

  // Log access when user views the shared call
  useEffect(() => {
    if (data?.isValid && user?.id && !accessLogged) {
      logAccess();
      setAccessLogged(true);
    }
  }, [data?.isValid, user?.id, accessLogged, logAccess]);

  // Redirect to login if not authenticated
  if (!authLoading && !user) {
    // Store token in sessionStorage to redirect back after login
    if (token) {
      sessionStorage.setItem('pendingShareToken', token);
    }
    navigate('/login');
    return null;
  }

  // Loading state
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading shared call...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <RiErrorWarningLine className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Error Loading Call
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            There was an error loading the shared call. Please try again or contact the person who shared it.
          </p>
          <Button onClick={() => navigate('/')}>
            <RiArrowLeftLine className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Revoked link state
  if (data?.isRevoked) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <RiLockLine className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Link Revoked
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This share link has been revoked by the owner. You no longer have access to this call.
          </p>
          <Button onClick={() => navigate('/')}>
            <RiArrowLeftLine className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Invalid or not found state
  if (!data?.isValid || !data?.call) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <RiLinksLine className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Call Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This share link is invalid or has expired. Please check the link or contact the person who shared it.
          </p>
          <Button onClick={() => navigate('/')}>
            <RiArrowLeftLine className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const { call, shareLink } = data;

  // Format duration if available
  const formatDuration = (duration: string | null) => {
    if (!duration) return null;
    // Duration might be in format "HH:MM:SS" or minutes
    return duration;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Shared Call Banner */}
        <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 flex items-center gap-3">
          <RiLinksLine className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Shared call from <span className="font-medium">{call.recorded_by_email}</span>
            </p>
          </div>
          <Badge variant="outline" className="text-purple-600 border-purple-600">
            <RiLinksLine className="w-3 h-3 mr-1" />
            SHARED
          </Badge>
        </div>

        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <RiArrowLeftLine className="w-4 h-4 mr-1" />
            Back to Home
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {call.call_name || 'Untitled Call'}
          </h1>

          {/* Call metadata */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
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
                <span className="text-gray-400">•</span>
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
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
            <RiFileTextLine className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Transcript
            </h2>
          </div>
          <div className="p-6">
            {call.full_transcript ? (
              <pre className="whitespace-pre-wrap font-sans text-gray-900 dark:text-white text-sm leading-relaxed">
                {call.full_transcript}
              </pre>
            ) : (
              <div className="text-center py-12">
                <RiFileTextLine className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No transcript available for this call
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer with share info */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Shared on {shareLink && formatDate(shareLink.created_at)}
            {shareLink?.recipient_email && (
              <span> with {shareLink.recipient_email}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharedCallView;

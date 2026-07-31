/**
 * CallDetailPage
 *
 * Thin redirect component that routes /call/:callId to the Calls page
 * with the call detail modal open.
 *
 * Per Phase 11 Decision D-07: Call detail must open as a modal overlay
 * (CallDetailDialog), not as a standalone page. Bookmarked URLs and shared
 * links still work — they are redirected to the Calls page, which then opens
 * the modal for the specified call.
 *
 * The redirect preserves deep-linking by passing callId as a URL search param:
 *   /call/12345  →  /transcripts?callId=12345
 *
 * The Calls page is /transcripts (see sidebar-nav.tsx) — it's the only route
 * with deep-link handling (TranscriptsTab watches ?callId= and opens
 * CallDetailDialog). The root "/" route renders ControlCenter, which does not
 * read ?callId= at all, so redirecting there silently drops the deep link and
 * the modal never opens.
 */

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export const CallDetailPage: React.FC = () => {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (callId) {
      navigate(`/transcripts?callId=${callId}`, { replace: true });
    } else {
      navigate('/transcripts', { replace: true });
    }
  }, [callId, navigate]);

  // Render nothing — the effect redirects immediately
  return null;
};

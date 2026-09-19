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
import { useParams, useNavigate, useLocation } from 'react-router-dom';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_RECORDING_ID_PATTERN = /^\d+$/;

export const CallDetailPage: React.FC = () => {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (callId && (UUID_PATTERN.test(callId) || LEGACY_RECORDING_ID_PATTERN.test(callId))) {
      const incoming = new URLSearchParams(location.search);
      const outgoing = new URLSearchParams({ callId });
      const accessRequest = incoming.get('accessRequest');
      if (UUID_PATTERN.test(callId) && accessRequest && UUID_PATTERN.test(accessRequest)) {
        outgoing.set('accessRequest', accessRequest);
      }
      navigate(`/transcripts?${outgoing.toString()}`, { replace: true });
    } else {
      navigate('/transcripts', { replace: true });
    }
  }, [callId, location.search, navigate]);

  // Render nothing — the effect redirects immediately
  return null;
};

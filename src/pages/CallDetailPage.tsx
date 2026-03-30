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
 *   /call/12345  →  /?callId=12345
 */

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export const CallDetailPage: React.FC = () => {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (callId) {
      navigate(`/?callId=${callId}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [callId, navigate]);

  // Render nothing — the effect redirects immediately
  return null;
};

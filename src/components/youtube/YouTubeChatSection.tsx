/**
 * YouTubeChatSection - Click-to-start chat CTA for video detail modal
 *
 * Displays a "Chat about this video" button that navigates to /chat
 * with vault context and recording prefilter, matching the existing
 * ChatLocationState pattern used in Chat.tsx.
 *
 * @pattern youtube-chat-cta
 * @brand-version v4.2
 */

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiChat3Line } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import type { ChatLocationState } from '@/types/chat'

export interface YouTubeChatSectionProps {
  /** Vault ID for scoping the chat session */
  vaultId: string
  /** Legacy recording ID (numeric) for prefilter */
  recordingId: number | null
  /** Video title for context display */
  videoTitle: string
  /** Close handler to dismiss the parent dialog */
  onClose: () => void
}

export function YouTubeChatSection({
  vaultId,
  recordingId,
  videoTitle,
  onClose,
}: YouTubeChatSectionProps) {
  const navigate = useNavigate()

  const handleStartChat = useCallback(() => {
    const state: ChatLocationState = {
      prefilter: {
        recordingIds: recordingId ? [recordingId] : [],
      },
      callTitle: videoTitle,
      newSession: true,
    }

    // Close the modal first, then navigate
    onClose()
    navigate('/chat', { state })
  }, [navigate, recordingId, videoTitle, onClose])

  return (
    <div className="border-t border-border py-4">
      <div className="flex items-start gap-3">
        <RiChat3Line className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground">Chat about this video</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ask questions about this video's content using AI
          </p>
          <Button
            variant="default"
            size="sm"
            onClick={handleStartChat}
            className="mt-3"
          >
            Start Chat
          </Button>
        </div>
      </div>
    </div>
  )
}

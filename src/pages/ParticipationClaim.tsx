import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiLoader4Line, RiMailCheckLine } from '@remixicon/react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import {
  clearPendingParticipationClaim,
  PARTICIPATION_CLAIM_ROUTE,
  readPendingParticipationClaim,
  storePendingParticipationClaim,
} from '@/lib/pending-participation-claim'
import {
  useConsumeParticipationClaim,
  useInspectParticipationClaim,
} from '@/hooks/useEventDiscovery'
import type {
  ParticipationClaimConsumeResult,
  ParticipationClaimInspectResult,
} from '@/types/event-discovery'

type ClaimStage =
  | 'capturing'
  | 'signed_out'
  | 'processing'
  | 'confirm_email'
  | 'retryable'
  | 'terminal'

function isUnavailableError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === 'CLAIM_UNAVAILABLE',
  )
}

function successMessage(count: number): string {
  if (count === 0) return 'Email verified. No matching events were found yet.'
  if (count === 1) return 'Email verified. We found 1 event.'
  return `Email verified. We found ${count} events.`
}

export function ParticipationClaim() {
  const navigate = useNavigate()
  const { user, loading: authLoading, signOut } = useAuth()
  const inspectClaim = useInspectParticipationClaim()
  const consumeClaim = useConsumeParticipationClaim()
  const [token, setToken] = useState<string | null>(null)
  const [stage, setStage] = useState<ClaimStage>('capturing')
  const [maskedInvitedEmail, setMaskedInvitedEmail] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const captureStartedRef = useRef(false)
  const inspectStartedRef = useRef(false)
  const consumeStartedRef = useRef(false)
  const accountSwitchStartedRef = useRef(false)

  const showTerminal = useCallback(() => {
    clearPendingParticipationClaim()
    setToken(null)
    setMaskedInvitedEmail(null)
    setStage('terminal')
  }, [])

  const showRetryable = useCallback(() => {
    setStage('retryable')
  }, [])

  const finishClaim = useCallback((result: ParticipationClaimConsumeResult) => {
    if (result.status === 'unavailable') {
      showTerminal()
      return
    }
    if (result.status === 'retryable') {
      showRetryable()
      return
    }

    clearPendingParticipationClaim()
    toast.success(successMessage(result.discoveredEventCount ?? 0))
    navigate('/events', { replace: true, state: { focusHeading: true } })
  }, [navigate, showRetryable, showTerminal])

  const consume = useCallback(async (confirmEmailAttachment: boolean) => {
    if (!token || consumeStartedRef.current) return
    consumeStartedRef.current = true
    setStage('processing')
    try {
      const result = await consumeClaim.mutateAsync({ token, confirmEmailAttachment })
      finishClaim(result)
    } catch (error: unknown) {
      consumeStartedRef.current = false
      if (isUnavailableError(error)) showTerminal()
      else showRetryable()
    }
  }, [consumeClaim, finishClaim, showRetryable, showTerminal, token])

  // Capture and scrub in a layout effect so no private or account-specific UI
  // can paint while the credential is still present in the address bar.
  useLayoutEffect(() => {
    if (captureStartedRef.current) return
    captureStartedRef.current = true

    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken !== null) {
      // Native replacement scrubs the credential synchronously. The queued
      // router replacement then updates BrowserRouter after its listener is
      // mounted, without ever carrying the token through router state.
      window.history.replaceState(window.history.state, '', PARTICIPATION_CLAIM_ROUTE)
      queueMicrotask(() => navigate(PARTICIPATION_CLAIM_ROUTE, { replace: true }))
      if (!storePendingParticipationClaim(urlToken)) {
        showTerminal()
        return
      }
      setToken(urlToken)
      return
    }

    const pendingToken = readPendingParticipationClaim()
    if (!pendingToken) {
      showTerminal()
      return
    }
    setToken(pendingToken)
  }, [navigate, showTerminal])

  useEffect(() => {
    if (!token || authLoading) return
    if (!user) {
      setStage('signed_out')
      return
    }
    if (inspectStartedRef.current) return

    inspectStartedRef.current = true
    setStage('processing')
    void (async () => {
      try {
        const result: ParticipationClaimInspectResult = await inspectClaim.mutateAsync(token)
        if (result.status === 'unavailable') {
          showTerminal()
          return
        }
        if (result.status === 'retryable') {
          inspectStartedRef.current = false
          showRetryable()
          return
        }
        if (result.confirmationRequired) {
          setMaskedInvitedEmail(result.maskedInvitedEmail)
          setStage('confirm_email')
          return
        }
        await consume(false)
      } catch (error: unknown) {
        inspectStartedRef.current = false
        if (isUnavailableError(error)) showTerminal()
        else showRetryable()
      }
    })()
  }, [attempt, authLoading, consume, inspectClaim, showRetryable, showTerminal, token, user])

  const retry = () => {
    if (stage !== 'retryable') return
    inspectStartedRef.current = false
    consumeStartedRef.current = false
    setAttempt((value) => value + 1)
  }

  const useAnotherAccount = async () => {
    if (accountSwitchStartedRef.current) return
    accountSwitchStartedRef.current = true
    await signOut()
    navigate('/login', { replace: true })
  }

  const content = (() => {
    if (stage === 'signed_out') {
      return {
        heading: 'Claim your participation',
        body: 'Sign in or create an account to verify this email and find events connected to you.',
        actions: (
          <Button type="button" onClick={() => navigate('/login', { replace: true })}>
            Continue to CallVault
          </Button>
        ),
      }
    }
    if (stage === 'confirm_email') {
      return {
        heading: 'Add this email to your account?',
        body: (
          <>
            You&apos;re signed in as {user?.email ?? 'your current account'}. Add{' '}
            <strong>{maskedInvitedEmail}</strong> as a verified email to find events connected to it.
          </>
        ),
        actions: (
          <div className="flex w-full flex-col gap-3">
            <Button
              type="button"
              disabled={consumeClaim.isPending || consumeStartedRef.current}
              onClick={() => void consume(true)}
            >
              Add email and continue
            </Button>
            <Button
              type="button"
              variant="hollow"
              disabled={accountSwitchStartedRef.current}
              onClick={() => void useAnotherAccount()}
            >
              Use another account
            </Button>
          </div>
        ),
      }
    }
    if (stage === 'retryable') {
      return {
        heading: "We couldn't finish this claim.",
        body: 'Check your connection and try again.',
        actions: (
          <Button type="button" disabled={inspectClaim.isPending || consumeClaim.isPending} onClick={retry}>
            Try again
          </Button>
        ),
      }
    }
    if (stage === 'terminal') {
      return {
        heading: 'This claim link is no longer available',
        body: 'Ask the recording owner to send a new invitation, or sign in to view events already connected to your account.',
        actions: (
          <Button type="button" onClick={() => navigate('/login', { replace: true })}>
            Sign in
          </Button>
        ),
      }
    }
    return {
      heading: stage === 'capturing' ? 'Preparing your claim…' : 'Verifying your email…',
      body: stage === 'capturing'
        ? 'Keep this page open while we prepare the secure claim.'
        : 'Keep this page open while we connect your events.',
      actions: null,
    }
  })()

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section
        className="w-full max-w-md rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-lg"
        aria-live="polite"
      >
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60" aria-hidden="true">
          {stage === 'capturing' || stage === 'processing'
            ? <RiLoader4Line className="h-6 w-6 animate-spin text-vibe-orange" />
            : <RiMailCheckLine className="h-6 w-6 text-vibe-orange" />}
        </div>
        <h1 className="font-display text-xl font-extrabold text-foreground">{content.heading}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{content.body}</p>
        {content.actions ? <div className="mt-7 flex justify-center">{content.actions}</div> : null}
      </section>
    </main>
  )
}

export default ParticipationClaim

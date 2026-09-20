export const PENDING_PARTICIPATION_CLAIM_KEY = 'pendingParticipationClaim'
export const PARTICIPATION_CLAIM_ROUTE = '/claim-participation'

const CLAIM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u

export function isParticipationClaimToken(value: unknown): value is string {
  return typeof value === 'string' && CLAIM_TOKEN_PATTERN.test(value)
}

export function storePendingParticipationClaim(value: unknown): boolean {
  if (!isParticipationClaimToken(value)) return false
  sessionStorage.setItem(PENDING_PARTICIPATION_CLAIM_KEY, value)
  return true
}

export function readPendingParticipationClaim(): string | null {
  const token = sessionStorage.getItem(PENDING_PARTICIPATION_CLAIM_KEY)
  if (token === null) return null
  if (isParticipationClaimToken(token)) return token
  sessionStorage.removeItem(PENDING_PARTICIPATION_CLAIM_KEY)
  return null
}

export function clearPendingParticipationClaim(): void {
  sessionStorage.removeItem(PENDING_PARTICIPATION_CLAIM_KEY)
}

export function hasPendingParticipationClaim(): boolean {
  return readPendingParticipationClaim() !== null
}

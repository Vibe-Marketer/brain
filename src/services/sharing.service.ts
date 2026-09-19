import { supabase } from '@/integrations/supabase/client'
import type {
  CreateShareLinkInput,
  ShareAccessLogWithUser,
  SharedCallPayload,
  SharedCallStatus,
  SharedWithMeRow,
  ShareLink,
  ManagedShareLink,
  ManagedShareLinks,
} from '@/types/sharing'

interface JsonObject {
  [key: string]: unknown
}

interface SharingQueryResult {
  data: unknown[] | null
  error: unknown
}

interface SharingClient {
  rpc: (name: string, args: Record<string, unknown>) => Promise<SharingQueryResult>
}

const sharingClient = supabase as unknown as SharingClient


function getShareCallUrl(path = ''): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('Supabase URL is not configured')
  return `${supabaseUrl}/functions/v1/share-call${path}`
}

function getPublishableKey(): string {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!key) throw new Error('Supabase publishable key is not configured')
  return key
}

async function getSessionAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session?.access_token ?? null
}

async function authenticatedHeaders(): Promise<Record<string, string>> {
  const accessToken = await getSessionAccessToken()
  if (!accessToken) throw new Error('Not authenticated')

  return {
    apikey: getPublishableKey(),
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

async function readJsonObject(response: Response): Promise<JsonObject> {
  try {
    const body: unknown = await response.json()
    return typeof body === 'object' && body !== null
      ? body as JsonObject
      : {}
  } catch {
    return {}
  }
}

function getErrorMessage(body: JsonObject, fallback: string): string {
  return typeof body.error === 'string' ? body.error : fallback
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export async function listShareLinks(
  recordingId: string,
): Promise<ManagedShareLinks> {
  const { data, error } = await sharingClient.rpc('list_owner_share_links_v2', {
    p_recording_id: recordingId,
  })

  if (error) throw error
  const links = (data ?? []) as ManagedShareLink[]
  return {
    recordingLinks: links.filter((link) => link.resolved_recording_id === recordingId),
    unresolvedLinks: links.filter((link) => link.resolved_recording_id === null),
  }
}

export async function createShareLink(
  input: CreateShareLinkInput,
): Promise<ShareLink> {
  const response = await fetch(getShareCallUrl(), {
    method: 'POST',
    headers: await authenticatedHeaders(),
    body: JSON.stringify(input),
  })
  const body = await readJsonObject(response)

  if (!response.ok) {
    throw new Error(getErrorMessage(body, 'Failed to create share link'))
  }
  if (!body.share_link || typeof body.share_link !== 'object') {
    throw new Error('Share link response was missing share_link')
  }

  return body.share_link as ShareLink
}

export async function revokeShareLink(linkId: string): Promise<void> {
  const response = await fetch(
    getShareCallUrl(`?id=${encodeURIComponent(linkId)}`),
    {
      method: 'DELETE',
      headers: await authenticatedHeaders(),
    },
  )
  const body = await readJsonObject(response)

  if (!response.ok) {
    throw new Error(getErrorMessage(body, 'Failed to revoke share link'))
  }
}

export async function getShareAccessLog(
  linkId: string,
): Promise<ShareAccessLogWithUser[]> {
  const response = await fetch(
    getShareCallUrl(`/access-log?id=${encodeURIComponent(linkId)}`),
    {
      method: 'GET',
      headers: await authenticatedHeaders(),
    },
  )
  const body = await readJsonObject(response)

  if (!response.ok) {
    throw new Error(getErrorMessage(body, 'Failed to load share access log'))
  }

  return Array.isArray(body.access_logs)
    ? body.access_logs as ShareAccessLogWithUser[]
    : []
}

export async function fetchSharedCall(
  token: string,
  logAccess: boolean,
): Promise<SharedCallStatus> {
  const query = new URLSearchParams({ token })
  if (logAccess) query.set('log_access', 'true')

  const headers: Record<string, string> = {
    apikey: getPublishableKey(),
    'Content-Type': 'application/json',
  }

  try {
    const accessToken = await getSessionAccessToken()
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`

    const response = await fetch(
      getShareCallUrl(`?${query.toString()}`),
      { headers },
    )
    const body = await readJsonObject(response)

    if (response.ok) {
      if (body.is_public_view === true) {
        return {
          status: 'public-view',
          inviter_name: optionalString(body.inviter_name) ?? 'Someone',
          call_title: optionalString(body.call_title) ?? 'An untitled call',
          recipient_email: optionalString(body.recipient_email),
          recipient_masked: optionalString(body.recipient_masked),
        }
      }

      if (
        body.is_valid === true
        && typeof body.share_link === 'object'
        && body.share_link !== null
        && typeof body.call === 'object'
        && body.call !== null
      ) {
        return {
          status: 'ok',
          shareLink: body.share_link as ShareLink,
          call: body.call as SharedCallPayload,
        }
      }

      return { status: 'error', message: 'Unexpected response shape' }
    }

    const code = optionalString(body.code)
    if (response.status === 403 && code === 'WRONG_RECIPIENT') {
      return {
        status: 'wrong-recipient',
        recipient_masked: optionalString(body.recipient_masked),
      }
    }
    if (
      response.status === 403
      && code === 'LINK_REVOKED'
      && typeof body.share_link === 'object'
      && body.share_link !== null
    ) {
      return {
        status: 'revoked',
        shareLink: body.share_link as Pick<ShareLink, 'id' | 'status' | 'revoked_at'>,
      }
    }
    if (
      response.status === 404
      && (code === 'LINK_NOT_FOUND' || code === 'CALL_NOT_FOUND')
    ) {
      return { status: 'not-found' }
    }

    return {
      status: 'error',
      message: getErrorMessage(body, 'Unknown error'),
    }
  } catch {
    return { status: 'error', message: 'Network error' }
  }
}

export async function listSharedWithMe(
  includeExpired = false,
): Promise<SharedWithMeRow[]> {
  const { data, error } = await sharingClient.rpc('get_calls_shared_with_me_v3', {
    p_include_expired: includeExpired,
  })

  if (error) throw error
  return (data ?? []) as SharedWithMeRow[]
}

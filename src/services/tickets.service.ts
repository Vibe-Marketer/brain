import { supabase } from '@/integrations/supabase/client'
import { getAppVersion, getCommit } from '@/services/support-ticket.service'
import type { Database } from '@/types/supabase'

export type TicketStatus = Database['public']['Enums']['ticket_status']
export type TicketSeverity = Database['public']['Enums']['ticket_severity']
export type TicketSource = Database['public']['Enums']['ticket_source']
export type TicketType = Database['public']['Enums']['ticket_type']

export type TicketRow = Database['public']['Tables']['tickets']['Row']
export type TicketMessage = Database['public']['Tables']['ticket_messages']['Row']
export type TicketEvent = Database['public']['Tables']['ticket_events']['Row']

/** List-view ticket: DB row plus derived display fields. */
export interface Ticket extends TicketRow {
  /** First-message excerpt for the Summary column (chronologically first). */
  summary: string | null
  /** Reporter display name or email; falls back to the raw reporter id. */
  reporter: string
}

export interface TicketDetail {
  ticket: TicketRow
  messages: TicketMessage[]
  events: TicketEvent[]
}

export interface TicketFilters {
  status?: TicketStatus | 'all'
  severity?: TicketSeverity | 'all'
  source?: TicketSource | 'all'
}

interface EmbeddedMessage {
  body: string
  created_at: string
}

type TicketListRow = TicketRow & { ticket_messages?: EmbeddedMessage[] | null }

function firstMessageBody(messages: EmbeddedMessage[] | null | undefined): string | null {
  if (!messages || messages.length === 0) return null
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  return sorted[0].body
}

export async function getTickets(filters: TicketFilters = {}): Promise<Ticket[]> {
  let query = supabase
    .from('tickets')
    .select('*, ticket_messages(body, created_at)')
    .order('created_at', { ascending: false })

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }
  if (filters.severity && filters.severity !== 'all') {
    query = query.eq('severity', filters.severity)
  }
  if (filters.source && filters.source !== 'all') {
    query = query.eq('source', filters.source)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch tickets: ${error.message}`)

  const rows = (data ?? []) as TicketListRow[]

  // Resolve reporter display names in one batch (admin RLS allows reading profiles)
  const reporterIds = [...new Set(rows.map((row) => row.reporter_id))]
  const reporterMap = new Map<string, string>()

  if (reporterIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('user_id, display_name, email')
      .in('user_id', reporterIds)

    if (!profilesError) {
      for (const profile of profiles ?? []) {
        const label = profile.display_name || profile.email
        if (label) reporterMap.set(profile.user_id, label)
      }
    }
  }

  return rows.map((row) => {
    const { ticket_messages, ...ticket } = row
    return {
      ...ticket,
      summary: firstMessageBody(ticket_messages),
      reporter: reporterMap.get(ticket.reporter_id) ?? ticket.reporter_id,
    }
  })
}

export async function getTicketDetail(ticketId: string): Promise<TicketDetail> {
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single()

  if (ticketError) throw new Error(`Failed to fetch ticket detail: ${ticketError.message}`)

  const { data: messages, error: messagesError } = await supabase
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (messagesError) throw new Error(`Failed to fetch ticket messages: ${messagesError.message}`)

  const { data: events, error: eventsError } = await supabase
    .from('ticket_events')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false })

  if (eventsError) throw new Error(`Failed to fetch ticket events: ${eventsError.message}`)

  return {
    ticket: ticket as TicketRow,
    messages: (messages ?? []) as TicketMessage[],
    events: (events ?? []) as TicketEvent[],
  }
}

/** Admin submission types — the enum supports more; the in-app form offers two (TKT-03). */
export type AdminTicketType = Extract<TicketType, 'bug' | 'task'>

export interface CreateTicketParams {
  type: AdminTicketType
  severity: TicketSeverity
  message: string
  userId?: string
  organizationId?: string | null
  workspaceId?: string | null
}

interface CreateTicketPayload {
  message: string
  type: AdminTicketType
  severity: TicketSeverity
  url: string
  userAgent: string
  userId?: string
  organizationId?: string
  workspaceId?: string
  appVersion?: string
  commit?: string
}

/**
 * Submits an admin ticket through the same send-support-ticket intake as the
 * support form, with context auto-attached (URL, user agent, org/workspace
 * ids, app version, commit) plus explicit type and severity.
 */
export async function createTicket(params: CreateTicketParams): Promise<void> {
  const payload: CreateTicketPayload = {
    message: params.message,
    type: params.type,
    severity: params.severity,
    url: window.location.href,
    userAgent: window.navigator.userAgent,
  }

  if (params.userId) payload.userId = params.userId
  if (params.organizationId) payload.organizationId = params.organizationId
  if (params.workspaceId) payload.workspaceId = params.workspaceId

  const appVersion = getAppVersion()
  const commit = getCommit()
  if (appVersion) payload.appVersion = appVersion
  if (commit) payload.commit = commit

  const { error } = await supabase.functions.invoke('send-support-ticket', {
    body: payload,
  })

  if (error) throw error
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .update({ status })
    .eq('id', ticketId)

  if (error) throw new Error(`Failed to update ticket status: ${error.message}`)
}

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TicketTable } from '../TicketTable'
import type { Ticket } from '@/services/tickets.service'

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'a1b2c3d4-0000-0000-0000-000000000001',
    reporter_id: 'user-1',
    reporter: 'Ada Lovelace',
    type: 'bug',
    severity: 'medium',
    status: 'new',
    source: 'manual',
    context: {},
    attempts: 0,
    fingerprint: null,
    last_seen_at: '2026-06-10T10:00:00.000Z',
    next_attempt_at: null,
    occurrence_count: 1,
    priority: 0,
    sentry_resolved_at: null,
    created_at: '2026-06-10T10:00:00.000Z',
    updated_at: '2026-06-10T10:00:00.000Z',
    urgent: false,
    ...overrides,
  }
}

describe('TicketTable', () => {
  const nightlyQaSource = ['nightly', 'qa'].join('_') as Ticket['source']
  const watchdogSource = ['inter', 'nal'].join('') as Ticket['source']

  it('renders a row per ticket with reporter, type, and source', () => {
    const tickets = [
      makeTicket(),
      makeTicket({
        id: 'a1b2c3d4-0000-0000-0000-000000000002',
        type: 'task',
        severity: 'high',
        status: 'in_progress',
        source: 'sentry',
        reporter: 'Grace Hopper',
      }),
    ]

    render(
      <TicketTable
        tickets={tickets}
        totalCount={2}
        hasActiveFilters={false}
        onRowClick={vi.fn()}
      />,
    )

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText('Bug')).toBeInTheDocument()
    expect(screen.getByText('Task')).toBeInTheDocument()
    expect(screen.getByText('Found by Sentry')).toBeInTheDocument()
  })

  it('fires onRowClick with the ticket id when a row is clicked', () => {
    const onRowClick = vi.fn()
    const ticket = makeTicket()

    render(
      <TicketTable
        tickets={[ticket]}
        totalCount={1}
        hasActiveFilters={false}
        onRowClick={onRowClick}
      />,
    )

    fireEvent.click(screen.getByText('Ada Lovelace'))

    expect(onRowClick).toHaveBeenCalledWith(ticket.id)
  })

})

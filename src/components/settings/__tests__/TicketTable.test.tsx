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
    summary: 'The export button does nothing',
    context: {},
    fingerprint: null,
    created_at: '2026-06-10T10:00:00.000Z',
    updated_at: '2026-06-10T10:00:00.000Z',
    ...overrides,
  }
}

describe('TicketTable', () => {
  it('renders a row per ticket with summary, reporter, type, and source', () => {
    const tickets = [
      makeTicket(),
      makeTicket({
        id: 'a1b2c3d4-0000-0000-0000-000000000002',
        type: 'task',
        severity: 'high',
        status: 'in_progress',
        source: 'sentry',
        summary: 'Investigate webhook retries',
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

    expect(screen.getByText('The export button does nothing')).toBeInTheDocument()
    expect(screen.getByText('Investigate webhook retries')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText('Bug')).toBeInTheDocument()
    expect(screen.getByText('Task')).toBeInTheDocument()
    expect(screen.getByText('sentry')).toBeInTheDocument()
  })

  it('renders status and severity StatusBadges per the UI-SPEC mapping', () => {
    render(
      <TicketTable
        tickets={[makeTicket({ status: 'escalated', severity: 'critical' })]}
        totalCount={1}
        hasActiveFilters={false}
        onRowClick={vi.fn()}
      />,
    )

    expect(screen.getByText('Escalated')).toBeInTheDocument()
    expect(screen.getByText('Critical')).toBeInTheDocument()
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

    fireEvent.click(screen.getByText('The export button does nothing'))

    expect(onRowClick).toHaveBeenCalledWith(ticket.id)
  })

  it('shows the footer row count', () => {
    render(
      <TicketTable
        tickets={[makeTicket()]}
        totalCount={5}
        hasActiveFilters={true}
        onRowClick={vi.fn()}
      />,
    )

    expect(screen.getByText('Showing 1 of 5 tickets')).toBeInTheDocument()
  })

  it('renders the default empty state when no filters are active', () => {
    render(
      <TicketTable
        tickets={[]}
        totalCount={0}
        hasActiveFilters={false}
        onRowClick={vi.fn()}
      />,
    )

    expect(screen.getByText('No tickets yet')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Tickets submitted from the support form or created here will appear in this list.',
      ),
    ).toBeInTheDocument()
  })

  it('renders the filtered empty state when filters are active', () => {
    render(
      <TicketTable
        tickets={[]}
        totalCount={4}
        hasActiveFilters={true}
        onRowClick={vi.fn()}
      />,
    )

    expect(screen.getByText('No tickets match your filters')).toBeInTheDocument()
    expect(screen.queryByText('No tickets yet')).not.toBeInTheDocument()
  })
})

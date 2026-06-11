import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NewTicketDialog } from '@/components/settings/NewTicketDialog'

const mocks = vi.hoisted(() => ({
  createTicket: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/services/tickets.service', () => ({
  createTicket: mocks.createTicket,
  getTickets: vi.fn(),
  getTicketDetail: vi.fn(),
  updateTicketStatus: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: {} }),
}))

vi.mock('@/hooks/useOrganizationContext', () => ({
  useOrganizationContext: () => ({ activeOrgId: 'org-1', activeWorkspaceId: 'ws-1' }),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/select', async () => {
  const React = await import('react')

  const SelectContext = React.createContext<{
    value?: string
    onValueChange?: (value: string) => void
  } | null>(null)

  return {
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode
      value?: string
      onValueChange?: (value: string) => void
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => {
      const context = React.useContext(SelectContext)
      return (
        <button
          type="button"
          aria-pressed={context?.value === value}
          onClick={() => context?.onValueChange?.(value)}
        >
          {children}
        </button>
      )
    },
  }
})

function renderDialog(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <NewTicketDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  )
  return { onOpenChange }
}

describe('NewTicketDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the locked copy: title, type bug|task only, four severities defaulting medium, description', () => {
    renderDialog()

    expect(screen.getByRole('heading', { name: 'New Ticket' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create ticket' })).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()

    // Type offers exactly bug and task (TKT-03) — never suggestion/question
    expect(screen.getByRole('button', { name: 'Bug' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Task' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Suggestion' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Question' })).not.toBeInTheDocument()

    // Four severities, default medium
    expect(screen.getByRole('button', { name: 'Critical' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'High' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Low' })).toBeInTheDocument()
  })

  it('disables submit while the description is empty and enables it once filled', () => {
    renderDialog()

    const submit = screen.getByRole('button', { name: 'Create ticket' })
    expect(submit).toBeDisabled()

    // Whitespace-only is still blocked
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '   ' } })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'The export button does nothing' },
    })
    expect(submit).toBeEnabled()
  })

  it('submits with the selected type and severity, shows the success toast, and closes', async () => {
    mocks.createTicket.mockResolvedValue(undefined)
    const { onOpenChange } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Task' }))
    fireEvent.click(screen.getByRole('button', { name: 'High' }))
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Wire up the export pipeline' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create ticket' }))

    await waitFor(() => expect(mocks.createTicket).toHaveBeenCalledTimes(1))
    expect(mocks.createTicket).toHaveBeenCalledWith({
      type: 'task',
      severity: 'high',
      message: 'Wire up the export pipeline',
      userId: 'user-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
    })

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Ticket created'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the error toast and keeps the dialog open when submission fails', async () => {
    mocks.createTicket.mockRejectedValue(new Error('boom'))
    const { onOpenChange } = renderDialog()

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Crash on load' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create ticket' }))

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('Ticket could not be created'),
    )
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'New Ticket' })).toBeInTheDocument()
  })
})

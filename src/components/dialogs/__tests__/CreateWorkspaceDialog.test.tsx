import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CreateWorkspaceDialog } from '@/components/dialogs/CreateWorkspaceDialog'

const mockMutate = vi.fn()

vi.mock('@/hooks/useOrganizationContext', () => ({
  useOrganizationContext: () => ({
    organizations: [
      { id: 'org-1', name: 'Workspace', type: 'business' },
    ],
    activeOrganizationId: 'org-1',
  }),
}))

vi.mock('@/hooks/useWorkspaceMutations', () => ({
  useCreateWorkspace: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children, id }: { children: React.ReactNode; id?: string }) => <p id={id}>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/select', async () => {
  const React = await import('react')

  const SelectContext = React.createContext<{
    value?: string
    onValueChange?: (value: string) => void
  } | null>(null)

  return {
    Select: ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (value: string) => void }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ''}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value, disabled }: { children: React.ReactNode; value: string; disabled?: boolean }) => {
      const context = React.useContext(SelectContext)
      return (
        <button
          type="button"
          disabled={disabled}
          aria-pressed={context?.value === value}
          onClick={() => context?.onValueChange?.(value)}
        >
          {children}
        </button>
      )
    },
  }
})

describe('CreateWorkspaceDialog', () => {
  beforeEach(() => {
    mockMutate.mockClear()
  })

  it('renders the create workspace dialog with a title', () => {
    render(
      <CreateWorkspaceDialog
        open
        onOpenChange={vi.fn()}
        orgId="org-1"
      />
    )

    expect(screen.getByText(/create new workspace/i)).toBeDefined()
  })

  it('renders workspace name input', () => {
    render(
      <CreateWorkspaceDialog
        open
        onOpenChange={vi.fn()}
        orgId="org-1"
      />
    )

    expect(screen.getByLabelText(/workspace name/i)).toBeDefined()
  })
})

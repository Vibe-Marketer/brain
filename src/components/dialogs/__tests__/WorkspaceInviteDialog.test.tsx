import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceInviteDialog } from "@/components/dialogs/WorkspaceInviteDialog";

// ─── Mocks ──────────────────────────────────────────────────────────

const mockCreateInvitation = vi.fn();
const mockFunctionsInvoke = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockGenerateInviteMutateAsync = vi.fn();

vi.mock("@/services/invitations.service", () => ({
  createInvitation: (...args: unknown[]) => mockCreateInvitation(...args),
}));

vi.mock("@/hooks/useWorkspaceMemberMutations", () => ({
  useGenerateWorkspaceInvite: () => ({
    mutateAsync: mockGenerateInviteMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/hooks/useWorkspaces", () => ({
  useOrganizationWorkspaces: (orgId: string | null) => {
    if (!orgId) return { workspaces: [], isLoading: false };
    return {
      workspaces: [
        { id: "ws-alpha", name: "Alpha Workspace", organization_id: "org-1" },
        { id: "ws-beta", name: "Beta Workspace", organization_id: "org-1" },
        { id: "ws-gamma", name: "Gamma Workspace", organization_id: "org-1" },
      ],
      isLoading: false,
    };
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "owner@callvault.ai", user_metadata: {} },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("@/hooks/useContactSuggestions", () => ({
  useContactSuggestions: () => [],
}));

vi.mock("@/components/contacts/ContactSuggestions", () => ({
  ContactSuggestions: () => null,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    id,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    id?: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock("@/components/ui/select", async () => {
  const React = await import("react");

  const SelectContext = React.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  } | null>(null);

  return {
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode;
      value?: string;
      onValueChange?: (value: string) => void;
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ""}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => {
      const context = React.useContext(SelectContext);
      return (
        <button type="button" aria-pressed={context?.value === value} onClick={() => context?.onValueChange?.(value)}>
          {children}
        </button>
      );
    },
  };
});

// ─── Tests ──────────────────────────────────────────────────────────

describe("WorkspaceInviteDialog — bulk workspace add", () => {
  beforeEach(() => {
    mockCreateInvitation.mockReset();
    mockFunctionsInvoke.mockReset().mockResolvedValue({ data: null, error: null });
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    mockGenerateInviteMutateAsync.mockReset();
  });

  it("does not show the workspace checklist when only one workspace is available (no organizationId)", () => {
    render(
      <WorkspaceInviteDialog
        open
        onOpenChange={vi.fn()}
        workspaceId="ws-alpha"
        workspaceName="Alpha Workspace"
      />
    );

    expect(screen.queryByText("Add to workspaces")).toBeNull();
  });

  it("shows a checklist of the org's workspaces, pre-checking the current workspace only", () => {
    render(
      <WorkspaceInviteDialog
        open
        onOpenChange={vi.fn()}
        workspaceId="ws-alpha"
        workspaceName="Alpha Workspace"
        organizationId="org-1"
      />
    );

    expect(screen.getByText("Add to workspaces")).toBeDefined();
    expect(screen.getByLabelText("Add to Alpha Workspace")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Add to Beta Workspace")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText("Add to Gamma Workspace")).toHaveAttribute("aria-checked", "false");
  });

  it("sends one invitation per checked workspace, applying the default role to all", async () => {
    const user = userEvent.setup();
    mockCreateInvitation.mockImplementation((workspaceId: string) =>
      Promise.resolve({
        id: `invite-${workspaceId}`,
        workspace_id: workspaceId,
        email: "new@teammate.com",
        role: "member",
        token: `token-${workspaceId}`,
        status: "pending",
      })
    );
    const onOpenChange = vi.fn();

    render(
      <WorkspaceInviteDialog
        open
        onOpenChange={onOpenChange}
        workspaceId="ws-alpha"
        workspaceName="Alpha Workspace"
        organizationId="org-1"
      />
    );

    await user.type(screen.getByLabelText(/email address/i), "new@teammate.com");
    await user.click(screen.getByLabelText("Add to Beta Workspace"));

    await user.click(screen.getByRole("button", { name: /send 2 invites/i }));

    await waitFor(() => expect(mockCreateInvitation).toHaveBeenCalledTimes(2));
    expect(mockCreateInvitation).toHaveBeenCalledWith("ws-alpha", "user-1", "new@teammate.com", "member");
    expect(mockCreateInvitation).toHaveBeenCalledWith("ws-beta", "user-1", "new@teammate.com", "member");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("applies a per-workspace role override without changing the other selected workspaces", async () => {
    const user = userEvent.setup();
    mockCreateInvitation.mockImplementation((workspaceId: string, _uid: string, _email: string, role: string) =>
      Promise.resolve({ id: `invite-${workspaceId}`, token: `token-${workspaceId}`, role })
    );

    render(
      <WorkspaceInviteDialog
        open
        onOpenChange={vi.fn()}
        workspaceId="ws-alpha"
        workspaceName="Alpha Workspace"
        organizationId="org-1"
      />
    );

    await user.type(screen.getByLabelText(/email address/i), "new@teammate.com");
    await user.click(screen.getByLabelText("Add to Beta Workspace"));

    // Override Beta's role to admin via its inline row selector. Scope the
    // query to Beta's row (checkbox + select share a row container) since
    // the global default-role selector also renders an "Admin" option.
    const betaRow = screen.getByLabelText("Add to Beta Workspace").closest("div");
    await user.click(within(betaRow!).getByText("Admin"));

    await user.click(screen.getByRole("button", { name: /send 2 invites/i }));

    await waitFor(() => expect(mockCreateInvitation).toHaveBeenCalledTimes(2));
    expect(mockCreateInvitation).toHaveBeenCalledWith("ws-alpha", "user-1", "new@teammate.com", "member");
    expect(mockCreateInvitation).toHaveBeenCalledWith("ws-beta", "user-1", "new@teammate.com", "workspace_admin");
  });

  it("keeps the dialog open and surfaces a failure when one workspace invite fails (partial failure)", async () => {
    const user = userEvent.setup();
    mockCreateInvitation.mockImplementation((workspaceId: string) => {
      if (workspaceId === "ws-beta") {
        return Promise.reject(new Error("new@teammate.com is already a member of this workspace."));
      }
      return Promise.resolve({ id: `invite-${workspaceId}`, token: `token-${workspaceId}` });
    });
    const onOpenChange = vi.fn();

    render(
      <WorkspaceInviteDialog
        open
        onOpenChange={onOpenChange}
        workspaceId="ws-alpha"
        workspaceName="Alpha Workspace"
        organizationId="org-1"
      />
    );

    await user.type(screen.getByLabelText(/email address/i), "new@teammate.com");
    await user.click(screen.getByLabelText("Add to Beta Workspace"));
    await user.click(screen.getByRole("button", { name: /send 2 invites/i }));

    await waitFor(() => expect(mockCreateInvitation).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    // Dialog must not auto-close when a workspace failed — the user needs to
    // see/retry it rather than lose track of which workspace didn't go through.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("select-all checks every workspace in the org", async () => {
    const user = userEvent.setup();

    render(
      <WorkspaceInviteDialog
        open
        onOpenChange={vi.fn()}
        workspaceId="ws-alpha"
        workspaceName="Alpha Workspace"
        organizationId="org-1"
      />
    );

    await user.click(screen.getByLabelText("Select all workspaces"));

    expect(screen.getByLabelText("Add to Alpha Workspace")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Add to Beta Workspace")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Add to Gamma Workspace")).toHaveAttribute("aria-checked", "true");
  });
});

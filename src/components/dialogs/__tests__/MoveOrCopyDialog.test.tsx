import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoveOrCopyDialog } from "@/components/dialogs/MoveOrCopyDialog";

const mockMoveMutate = vi.fn();
const mockCreateOrgMutate = vi.fn();
let mockWorkspaceCreated: ((workspaceId: string) => void) | undefined;

vi.mock("@/hooks/useOrganizationContext", () => ({
  useOrganizationContext: () => ({
    activeOrgId: "org-1",
  }),
}));

vi.mock("@/hooks/useWorkspaces", () => ({
  useAllUserWorkspaces: () => ({
    workspaces: [
      { id: "ws-current", name: "Current Workspace", organization_id: "org-1" },
      { id: "ws-existing", name: "Existing Workspace", organization_id: "org-1" },
      { id: "ws-other-org", name: "Other Org Workspace", organization_id: "org-2" },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useOrganizations", () => ({
  useOrganizations: () => ({
    data: [
      { id: "org-1", name: "Org One" },
      { id: "org-2", name: "Org Two" },
    ],
    isLoading: false,
  }),
  useCreateOrganization: () => ({
    mutate: mockCreateOrgMutate,
    isPending: false,
  }),
}));

vi.mock("@/hooks/useDataMovement", () => ({
  useMoveRecordings: () => ({
    mutate: mockMoveMutate,
    isPending: false,
  }),
}));

vi.mock("@/components/dialogs/CreateWorkspaceDialog", () => ({
  CreateWorkspaceDialog: ({
    open,
    orgId,
    onWorkspaceCreated,
  }: {
    open: boolean;
    orgId?: string;
    onWorkspaceCreated?: (workspaceId: string) => void;
  }) => {
    mockWorkspaceCreated = onWorkspaceCreated;

    if (!open) return null;

    return (
      <div role="dialog" aria-label="Create New Workspace">
        <span data-testid="create-workspace-org">{orgId}</span>
        Create New Workspace
      </div>
    );
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    ...props
  }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
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
    SelectTrigger: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => (
      <span>{placeholder ?? ""}</span>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SelectGroup: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SelectLabel: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    SelectItem: ({
      children,
      value,
      disabled,
    }: {
      children: React.ReactNode;
      value: string;
      disabled?: boolean;
    }) => {
      const context = React.useContext(SelectContext);
      return (
        <button
          type="button"
          disabled={disabled}
          aria-pressed={context?.value === value}
          onClick={() => context?.onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
  };
});

describe("MoveOrCopyDialog", () => {
  beforeEach(() => {
    mockMoveMutate.mockClear();
    mockCreateOrgMutate.mockClear();
    mockWorkspaceCreated = undefined;
  });

  it("same-org copy: defaults org to active org, dispatches with keepInSource true when toggle=Copy", async () => {
    const user = userEvent.setup();

    render(
      <MoveOrCopyDialog
        open
        onOpenChange={vi.fn()}
        recordingIds={["recording-1"]}
        currentWorkspaceId="ws-current"
      />,
    );

    // Org select defaults to org-1 (current) — workspace list should show org-1 workspaces
    expect(screen.getByText("Existing Workspace")).toBeDefined();

    await user.click(screen.getByText("Existing Workspace"));

    // Flip toggle to Copy
    await user.click(screen.getByRole("button", { name: /^copy$/i }));

    await user.click(screen.getByRole("button", { name: /^copy call$/i }));

    expect(mockMoveMutate).toHaveBeenCalledWith(
      {
        recordingIds: ["recording-1"],
        target: {
          workspaceId: "ws-existing",
          organizationId: "org-1",
        },
        options: {
          sourceOrgId: "org-1",
          sourceWorkspaceId: "ws-current",
          keepInSource: true,
          onProgress: expect.any(Function),
        },
      },
      expect.any(Object),
    );

    const callArgs = mockMoveMutate.mock.calls[0][0];
    expect(callArgs.target.organizationId).toBe("org-1");
  });

  it("same-org move: default toggle=Move dispatches keepInSource false", async () => {
    const user = userEvent.setup();

    render(
      <MoveOrCopyDialog
        open
        onOpenChange={vi.fn()}
        recordingIds={["recording-1"]}
        currentWorkspaceId="ws-current"
      />,
    );

    await user.click(screen.getByText("Existing Workspace"));
    await user.click(screen.getByRole("button", { name: /^move call$/i }));

    expect(mockMoveMutate).toHaveBeenCalledWith(
      {
        recordingIds: ["recording-1"],
        target: {
          workspaceId: "ws-existing",
          organizationId: "org-1",
        },
        options: {
          sourceOrgId: "org-1",
          sourceWorkspaceId: "ws-current",
          keepInSource: false,
          onProgress: expect.any(Function),
        },
      },
      expect.any(Object),
    );
  });

  it("cross-org move: selecting another org re-scopes workspaces and dispatches with mismatched org ids", async () => {
    const user = userEvent.setup();

    render(
      <MoveOrCopyDialog
        open
        onOpenChange={vi.fn()}
        recordingIds={["recording-1"]}
        currentWorkspaceId="ws-current"
      />,
    );

    // Same-org workspace visible before switching org
    expect(screen.getByText("Existing Workspace")).toBeDefined();
    expect(screen.queryByText("Other Org Workspace")).toBeNull();

    // Switch org to org-2
    await user.click(screen.getByText("Org Two"));

    // Workspace select re-scoped: org-2 workspace visible, org-1 workspace gone
    expect(screen.getByText("Other Org Workspace")).toBeDefined();
    expect(screen.queryByText("Existing Workspace")).toBeNull();

    await user.click(screen.getByText("Other Org Workspace"));
    await user.click(screen.getByRole("button", { name: /^move call$/i }));

    expect(mockMoveMutate).toHaveBeenCalledWith(
      {
        recordingIds: ["recording-1"],
        target: {
          workspaceId: "ws-other-org",
          organizationId: "org-2",
        },
        options: {
          sourceOrgId: "org-1",
          sourceWorkspaceId: "ws-current",
          keepInSource: false,
          onProgress: expect.any(Function),
        },
      },
      expect.any(Object),
    );

    const callArgs = mockMoveMutate.mock.calls[0][0];
    expect(callArgs.target.organizationId).not.toBe(callArgs.options.sourceOrgId);
  });

  it("same-org helper text differs between Move and Copy — Move warns of removal, Copy does not", async () => {
    const user = userEvent.setup();

    render(
      <MoveOrCopyDialog
        open
        onOpenChange={vi.fn()}
        recordingIds={["recording-1"]}
        currentWorkspaceId="ws-current"
      />,
    );

    // Default toggle is Move — helper text must say it removes the call from the source workspace.
    expect(screen.getByText(/removes it from this workspace/i)).toBeDefined();
    expect(screen.queryByText(/keeping it in this workspace too/i)).toBeNull();

    // Flip to Copy — helper text must say it keeps the call in the source workspace too.
    await user.click(screen.getByRole("button", { name: /^copy$/i }));

    expect(screen.getByText(/keeping it in this workspace too/i)).toBeDefined();
    expect(screen.queryByText(/removes it from this workspace/i)).toBeNull();
  });

  it("opens create workspace scoped to the selected (non-active) org", async () => {
    const user = userEvent.setup();

    render(
      <MoveOrCopyDialog
        open
        onOpenChange={vi.fn()}
        recordingIds={["recording-1"]}
        currentWorkspaceId="ws-current"
      />,
    );

    // Switch org to org-2 first
    await user.click(screen.getByText("Org Two"));

    await user.click(screen.getByText(/\+ new workspace/i));

    expect(screen.getByRole("dialog", { name: /create new workspace/i })).toBeDefined();
    expect(screen.getByTestId("create-workspace-org").textContent).toBe("org-2");

    act(() => {
      mockWorkspaceCreated?.("ws-new");
    });

    await user.click(screen.getByRole("button", { name: /^move call$/i }));

    expect(mockMoveMutate).toHaveBeenCalledWith(
      {
        recordingIds: ["recording-1"],
        target: {
          workspaceId: "ws-new",
          organizationId: "org-2",
        },
        options: {
          sourceOrgId: "org-1",
          sourceWorkspaceId: "ws-current",
          keepInSource: false,
          onProgress: expect.any(Function),
        },
      },
      expect.any(Object),
    );
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoveToWorkspaceDialog } from "@/components/dialogs/MoveToWorkspaceDialog";

const mockMoveMutate = vi.fn();
let mockWorkspaceCreated: ((workspaceId: string) => void) | undefined;

vi.mock("@/hooks/useOrganizationContext", () => ({
  useOrganizationContext: () => ({
    activeOrgId: "org-1",
  }),
}));

vi.mock("@/hooks/useWorkspaces", () => ({
  useWorkspaces: () => ({
    workspaces: [
      { id: "ws-current", name: "Current Workspace" },
      { id: "ws-existing", name: "Existing Workspace" },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useDataMovement", () => ({
  useMoveToWorkspace: () => ({
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

describe("MoveToWorkspaceDialog", () => {
  beforeEach(() => {
    mockMoveMutate.mockClear();
    mockWorkspaceCreated = undefined;
  });

  it("opens create workspace from the target picker and moves to the created workspace", async () => {
    const user = userEvent.setup();

    render(
      <MoveToWorkspaceDialog
        open
        onOpenChange={vi.fn()}
        recordingIds={["recording-1"]}
        currentWorkspaceId="ws-current"
      />,
    );

    await user.click(screen.getByText(/create new workspace/i));

    expect(screen.getByRole("dialog", { name: /create new workspace/i })).toBeDefined();
    expect(screen.getByTestId("create-workspace-org").textContent).toBe("org-1");

    act(() => {
      mockWorkspaceCreated?.("ws-new");
    });

    await user.click(screen.getByRole("button", { name: /^move call$/i }));

    expect(mockMoveMutate).toHaveBeenCalledWith(
      {
        recordingIds: ["recording-1"],
        targetWorkspaceId: "ws-new",
        options: {
          sourceWorkspaceId: "ws-current",
          keepInSource: false,
        },
      },
      expect.any(Object),
    );
  });
});

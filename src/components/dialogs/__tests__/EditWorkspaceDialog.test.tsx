import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditWorkspaceDialog } from "@/components/dialogs/EditWorkspaceDialog";
import type { WorkspaceDetail } from "@/hooks/useWorkspaces";

const mockWorkspace: WorkspaceDetail = {
  id: "ws-1",
  organization_id: "org-1",
  name: "Acme Sales",
  workspace_type: "team",
  default_sharelink_ttl_days: 7,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  member_count: 3,
  user_role: "workspace_owner",
  memberships: [],
};

vi.mock("@/hooks/useWorkspaceMutations", () => ({
  useUpdateWorkspace: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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

describe("EditWorkspaceDialog", () => {
  it("renders the workspace settings title", () => {
    render(
      <EditWorkspaceDialog
        open
        onOpenChange={vi.fn()}
        workspace={mockWorkspace}
        userRole="workspace_owner"
      />,
    );
    expect(screen.getByText(/workspace settings/i)).toBeDefined();
  });

  it("renders workspace name input pre-filled", () => {
    render(
      <EditWorkspaceDialog
        open
        onOpenChange={vi.fn()}
        workspace={mockWorkspace}
        userRole="workspace_owner"
      />,
    );
    const input = screen.getByLabelText(
      /edit workspace name/i,
    ) as HTMLInputElement;
    expect(input.value).toBe("Acme Sales");
  });

  it("renders share link expiration input", () => {
    render(
      <EditWorkspaceDialog
        open
        onOpenChange={vi.fn()}
        workspace={mockWorkspace}
        userRole="workspace_owner"
      />,
    );
    expect(screen.getByLabelText(/share link expiration/i)).toBeDefined();
  });
});

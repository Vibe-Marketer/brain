import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeleteWorkspaceDialog } from "@/components/dialogs/DeleteWorkspaceDialog";
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
  useDeleteWorkspace: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useWorkspaces", () => ({
  useWorkspaces: () => ({ workspaces: [] }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
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

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input type="checkbox" {...props} />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder ?? ""}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("DeleteWorkspaceDialog", () => {
  it("renders the delete workspace title", () => {
    render(
      <DeleteWorkspaceDialog
        open
        onOpenChange={vi.fn()}
        workspace={mockWorkspace}
      />,
    );
    expect(screen.getAllByText(/delete workspace/i).length).toBeGreaterThan(0);
  });

  it("renders warning about permanent deletion", () => {
    render(
      <DeleteWorkspaceDialog
        open
        onOpenChange={vi.fn()}
        workspace={mockWorkspace}
      />,
    );
    expect(screen.getByText(/cannot be undone/i)).toBeDefined();
  });

  it("renders the workspace name confirmation prompt", () => {
    render(
      <DeleteWorkspaceDialog
        open
        onOpenChange={vi.fn()}
        workspace={mockWorkspace}
      />,
    );
    // confirmation label references the workspace name
    expect(screen.getAllByText(/acme sales/i).length).toBeGreaterThan(0);
  });

  it("renders confirmation input", () => {
    render(
      <DeleteWorkspaceDialog
        open
        onOpenChange={vi.fn()}
        workspace={mockWorkspace}
      />,
    );
    expect(screen.getByLabelText(/type.*to confirm/i)).toBeDefined();
  });
});

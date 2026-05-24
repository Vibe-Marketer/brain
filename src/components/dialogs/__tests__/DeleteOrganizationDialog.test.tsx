import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeleteOrganizationDialog } from "@/components/dialogs/DeleteOrganizationDialog";
import type { OrganizationWithMembership } from "@/types/workspace";

const mockOrg: OrganizationWithMembership = {
  id: "org-1",
  name: "Acme Corp",
  type: "business",
  cross_org_default: "copy_only",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  membership: {
    id: "mem-1",
    organization_id: "org-1",
    user_id: "user-1",
    role: "organization_owner",
    created_at: "2024-01-01T00:00:00Z",
  },
};

vi.mock("@/hooks/useOrganizationMutations", () => ({
  useDeleteOrganization: () => ({ mutate: vi.fn(), isPending: false }),
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

describe("DeleteOrganizationDialog", () => {
  it("renders the delete organization title", () => {
    render(
      <DeleteOrganizationDialog
        open
        onOpenChange={vi.fn()}
        organization={mockOrg}
      />,
    );
    expect(screen.getAllByText(/delete organization/i).length).toBeGreaterThan(
      0,
    );
  });

  it("renders warning about permanent deletion", () => {
    render(
      <DeleteOrganizationDialog
        open
        onOpenChange={vi.fn()}
        organization={mockOrg}
      />,
    );
    expect(screen.getByText(/cannot be undone/i)).toBeDefined();
  });

  it("renders the organization name in the warning", () => {
    render(
      <DeleteOrganizationDialog
        open
        onOpenChange={vi.fn()}
        organization={mockOrg}
      />,
    );
    expect(screen.getAllByText(/acme corp/i).length).toBeGreaterThan(0);
  });
});

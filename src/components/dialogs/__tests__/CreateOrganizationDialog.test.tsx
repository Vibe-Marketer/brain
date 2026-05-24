import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreateOrganizationDialog } from "@/components/dialogs/CreateOrganizationDialog";

vi.mock("@/hooks/useOrganizationMutations", () => ({
  useCreateBusinessOrganization: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/components/dialogs/CreateWorkspaceDialog", () => ({
  CreateWorkspaceDialog: () => null,
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

describe("CreateOrganizationDialog", () => {
  it("renders the create organization title", () => {
    render(<CreateOrganizationDialog open onOpenChange={vi.fn()} />);
    expect(
      screen.getAllByText(/create business organization/i).length,
    ).toBeGreaterThan(0);
  });

  it("renders organization name input", () => {
    render(<CreateOrganizationDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText(/organization name/i)).toBeDefined();
  });
});

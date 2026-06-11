import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UsersSection from "../UsersSection";
import * as useAdminUsersHook from "@/hooks/useAdminUsers";
import { useAdminDetailStore } from "@/stores/adminDetailStore";
import type { AdminUserProfile } from "@/services/admin-users.service";

vi.mock("@/hooks/useAdminUsers", () => ({
  useAdminUsers: vi.fn(),
}));

function makeUser(overrides: Partial<AdminUserProfile>): AdminUserProfile {
  return {
    id: "user-1",
    profile_id: "profile-1",
    email: "user@example.com",
    display_name: "User One",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    last_login_at: null,
    role: "FREE",
    subscription_status: null,
    product_id: null,
    polar_customer_id: null,
    ...overrides,
  };
}

function mockUsers(users: AdminUserProfile[]) {
  vi.mocked(useAdminUsersHook.useAdminUsers).mockReturnValue({
    data: users,
    isLoading: false,
    error: null,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  useAdminDetailStore.setState({ detail: null });
});

describe("UsersSection", () => {
  it("renders the user table with role badges and counts", () => {
    mockUsers([
      makeUser({ id: "u1", email: "admin@example.com", role: "ADMIN" }),
      makeUser({ id: "u2", email: "free@example.com", role: "FREE" }),
    ]);

    render(<UsersSection />);

    expect(screen.getByText("2 users · 1 admins")).toBeTruthy();
    expect(screen.getByText("admin@example.com")).toBeTruthy();
    expect(screen.getByText("free@example.com")).toBeTruthy();
  });

  it("filters by search text", () => {
    mockUsers([
      makeUser({ id: "u1", email: "alpha@example.com" }),
      makeUser({ id: "u2", email: "beta@example.com" }),
    ]);

    render(<UsersSection />);
    fireEvent.change(screen.getByPlaceholderText("Search email, name, id…"), {
      target: { value: "alpha" },
    });

    expect(screen.getByText("alpha@example.com")).toBeTruthy();
    expect(screen.queryByText("beta@example.com")).toBeNull();
  });

  it("opens the pane-native detail via adminDetailStore on row click", () => {
    mockUsers([makeUser({ id: "auth-user-42", email: "click@example.com" })]);

    render(<UsersSection />);
    fireEvent.click(screen.getByText("click@example.com"));

    expect(useAdminDetailStore.getState().detail).toEqual({
      type: "user",
      id: "auth-user-42",
    });
  });

  it("shows the empty state when no users match", () => {
    mockUsers([]);

    render(<UsersSection />);
    expect(screen.getByText("No users found")).toBeTruthy();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { getAvailableSources } from "../recordings.service";

const mocks = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  recordingsSelect: vi.fn(),
  importSourcesSelect: vi.fn(),
  workspaceEntriesSelect: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: mocks.authGetUser },
    from: (table: string) => {
      if (table === "recordings") {
        return { select: mocks.recordingsSelect };
      }
      if (table === "import_sources") {
        return { select: mocks.importSourcesSelect };
      }
      if (table === "workspace_entries") {
        return { select: mocks.workspaceEntriesSelect };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

function chain(result: unknown) {
  const api = {
    eq: vi.fn(() => api),
    not: vi.fn(() => Promise.resolve(result)),
  };
  return api;
}

describe("getAvailableSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mocks.importSourcesSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      then: undefined,
    });
  });

  it("includes active connected sources even when they have no recordings yet", async () => {
    mocks.recordingsSelect.mockReturnValue(
      chain({
        data: [{ source_app: "fathom" }, { source_app: "youtube" }],
        error: null,
      }),
    );
    const importEq = vi.fn();
    mocks.importSourcesSelect.mockReturnValue({
      eq: importEq.mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) =>
        resolve({
          data: [{ source_app: "read-ai" }, { source_app: "grain" }],
          error: null,
        }),
    });

    await expect(getAvailableSources("org-1")).resolves.toEqual([
      "fathom",
      "read-ai",
      "youtube",
    ]);
  });
});

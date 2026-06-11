import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  inCalls: [] as string[][],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table !== "call_tag_assignments") {
        throw new Error(`Unexpected table in test: ${table}`);
      }

      return {
        select: vi.fn(() => ({
          in: vi.fn((column: string, ids: string[]) => {
            expect(column).toBe("recording_id");
            state.inCalls.push(ids);

            return Promise.resolve({
              data: ids.map((id) => ({
                recording_id: id,
                tag_id: `tag-${id}`,
              })),
              error: null,
            });
          }),
        })),
      };
    }),
  },
}));

vi.mock("@/hooks/useOrganizationContext", () => ({
  useOrganizationContext: vi.fn(() => ({
    activeOrganizationId: null,
    activeWorkspaceId: null,
    activeWorkspace: null,
    isPersonalOrganization: false,
    isSharedView: false,
    isLoading: false,
    isInitialized: true,
  })),
}));

const makeIds = (count: number) =>
  Array.from({ length: count }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

describe("TranscriptsTab ID batching", () => {
  beforeEach(() => {
    state.inCalls = [];
  });

  it("splits displayed-call tag assignment lookups into <=100-id chunks", async () => {
    const { fetchTagAssignmentsForRecordingUuids } = await import("../TranscriptsTab");
    const ids = makeIds(250);

    const rows = await fetchTagAssignmentsForRecordingUuids(ids);

    expect(state.inCalls).toHaveLength(3);
    for (const call of state.inCalls) {
      expect(call.length).toBeLessThanOrEqual(100);
    }
    expect(state.inCalls.flat()).toEqual(ids);
    expect(rows.map((row) => row.recording_id)).toEqual(ids);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  inCalls: [] as string[][],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table !== "call_participants") {
        throw new Error(`Unexpected table in test: ${table}`);
      }

      return {
        select: vi.fn(() => ({
          in: vi.fn((column: string, ids: string[]) => {
            expect(column).toBe("recording_id");
            state.inCalls.push(ids);

            return {
              not: vi.fn(() =>
                Promise.resolve({
                  data: ids.map((id) => ({
                    recording_id: id,
                    name: `Participant ${id}`,
                    email: `${id}@example.com`,
                  })),
                }),
              ),
            };
          }),
        })),
      };
    }),
  },
}));

const makeIds = (count: number) =>
  Array.from({ length: count }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

describe("useGlobalSearch ID batching", () => {
  beforeEach(() => {
    state.inCalls = [];
  });

  it("splits participant lookups into <=100-id chunks", async () => {
    const { fetchParticipants } = await import("../useGlobalSearch");
    const ids = makeIds(250);

    const participants = await fetchParticipants(ids, null);

    expect(state.inCalls).toHaveLength(3);
    for (const call of state.inCalls) {
      expect(call.length).toBeLessThanOrEqual(100);
    }
    expect(state.inCalls.flat()).toEqual(ids);
    expect(Object.keys(participants)).toEqual(ids);
  });
});

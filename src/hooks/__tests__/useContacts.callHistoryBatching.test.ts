import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression test for QA ticket b96e351b.
 *
 * useContactCallHistory previously ran a single unbounded
 * `.in("id", recordingIds)` against `recordings`. For accounts with many
 * recordings the PostgREST request URL exceeded length limits and the API
 * returned HTTP 400, silently breaking contact call history on /people Edit.
 *
 * The fix (fetchContactCallRecordings) chunks the lookup at <=100 ids per
 * request, runs chunks in parallel, and merges results.
 */

const state = vi.hoisted(() => ({
  inCalls: [] as string[][],
  errorOnChunkIndex: null as number | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table !== "recordings") {
        throw new Error(`Unexpected table in test: ${table}`);
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn((column: string, ids: string[]) => {
              expect(column).toBe("id");
              const chunkIndex = state.inCalls.length;
              state.inCalls.push(ids);

              if (state.errorOnChunkIndex === chunkIndex) {
                return Promise.resolve({
                  data: null,
                  error: { message: "simulated PostgREST failure" },
                });
              }

              return Promise.resolve({
                data: ids.map((id) => ({
                  id,
                  fathom_provider_id: null,
                  title: `Call ${id}`,
                  recording_start_time: "2026-06-01T10:00:00.000Z",
                  duration: 60,
                })),
                error: null,
              });
            }),
          })),
        })),
      };
    }),
  },
}));

vi.mock("@/lib/auth-utils", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { fetchContactCallRecordings } from "@/hooks/useContacts";

const makeIds = (count: number) =>
  Array.from({ length: count }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

describe("fetchContactCallRecordings batching (qa-b96e351b)", () => {
  beforeEach(() => {
    state.inCalls = [];
    state.errorOnChunkIndex = null;
  });

  it("splits >100 recording ids into multiple .in() calls of <=100 each", async () => {
    const ids = makeIds(250);

    const rows = await fetchContactCallRecordings("org-1", ids);

    // Multiple batched requests, never an unbounded list
    expect(state.inCalls.length).toBeGreaterThan(1);
    expect(state.inCalls).toHaveLength(3);
    for (const call of state.inCalls) {
      expect(call.length).toBeLessThanOrEqual(100);
    }

    // All ids covered exactly once, order preserved across merged chunks
    expect(state.inCalls.flat()).toEqual(ids);
    expect(rows).toHaveLength(250);
    expect(rows.map((r) => r.id)).toEqual(ids);

    // Row shape preserved
    expect(rows[0]).toEqual({
      id: ids[0],
      fathom_provider_id: null,
      title: `Call ${ids[0]}`,
      recording_start_time: "2026-06-01T10:00:00.000Z",
      duration: 60,
    });
  });

  it("uses a single request when ids fit in one chunk", async () => {
    const ids = makeIds(100);

    const rows = await fetchContactCallRecordings("org-1", ids);

    expect(state.inCalls).toHaveLength(1);
    expect(state.inCalls[0]).toEqual(ids);
    expect(rows).toHaveLength(100);
  });

  it("returns [] without querying for an empty id list", async () => {
    const rows = await fetchContactCallRecordings("org-1", []);

    expect(state.inCalls).toHaveLength(0);
    expect(rows).toEqual([]);
  });

  it("throws when any chunk request fails", async () => {
    state.errorOnChunkIndex = 1;
    const ids = makeIds(150);

    await expect(fetchContactCallRecordings("org-1", ids)).rejects.toMatchObject({
      message: "simulated PostgREST failure",
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { resolveGrainSource } from "../grain-source.ts";

function createSourceQuery(result: unknown) {
  const query = {
    from: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
  };
  return query;
}

describe("resolveGrainSource", () => {
  it("scopes caller-provided source ids to the user's Grain sources", async () => {
    const query = createSourceQuery({ data: { id: "source-1" }, error: null });

    await expect(resolveGrainSource(query, "user-1", "source-1")).resolves.toEqual({ id: "source-1" });

    expect(query.from).toHaveBeenCalledWith("import_sources");
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("source_app", "grain");
    expect(query.eq).toHaveBeenCalledWith("id", "source-1");
  });

  it("selects the latest active Grain source when no source id is provided", async () => {
    const query = createSourceQuery({ data: { id: "source-2" }, error: null });

    await expect(resolveGrainSource(query, "user-1", null)).resolves.toEqual({ id: "source-2" });

    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(query.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it("surfaces lookup errors instead of treating them as disconnected", async () => {
    const query = createSourceQuery({ data: null, error: new Error("database unavailable") });

    await expect(resolveGrainSource(query, "user-1", "source-1")).rejects.toThrow("database unavailable");
  });
});

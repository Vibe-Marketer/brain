import { describe, expect, it, vi } from "vitest";
import { resolveReadAiSource } from "../read-ai-source";

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

describe("resolveReadAiSource", () => {
  it("scopes caller-provided source ids to the user's Read.ai sources", async () => {
    const query = createSourceQuery({ data: { id: "source-1" }, error: null });

    await expect(resolveReadAiSource(query, "user-1", "source-1")).resolves.toEqual({ id: "source-1" });

    expect(query.from).toHaveBeenCalledWith("import_sources");
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("source_app", "read-ai");
    expect(query.eq).toHaveBeenCalledWith("id", "source-1");
  });

  it("selects the latest active Read.ai source when no source id is provided", async () => {
    const query = createSourceQuery({ data: { id: "source-2" }, error: null });

    await expect(resolveReadAiSource(query, "user-1", null)).resolves.toEqual({ id: "source-2" });

    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(query.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it("surfaces lookup errors instead of treating them as disconnected", async () => {
    const query = createSourceQuery({ data: null, error: new Error("database unavailable") });

    await expect(resolveReadAiSource(query, "user-1", "source-1")).rejects.toThrow("database unavailable");
  });
});

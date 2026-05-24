import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetAdapterRegistryForTests,
  dispatchConnectorRequest,
  registerAdapter,
  type AdapterContext,
  type ConnectorAdapter,
  type ConnectorRequest,
} from "../connector-framework";

const ctx = {
  supabase: {} as AdapterContext["supabase"],
  userId: "00000000-0000-0000-0000-000000000001",
} satisfies AdapterContext;

beforeEach(() => {
  _resetAdapterRegistryForTests();
});

describe("dispatchConnectorRequest — validation", () => {
  it("returns 400 when body is missing", async () => {
    const result = await dispatchConnectorRequest(
      ctx,
      undefined as unknown as ConnectorRequest,
    );
    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it("returns 400 when source is empty", async () => {
    const result = await dispatchConnectorRequest(ctx, {
      source: "",
      action: "connect",
    });
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/source/);
  });

  it("returns 400 when action is not in the allowed set", async () => {
    const result = await dispatchConnectorRequest(ctx, {
      source: "x",
      action: "drop" as ConnectorRequest["action"],
    });
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(
      /connect, disconnect, fetch, sync, status/,
    );
  });
});

describe("dispatchConnectorRequest — adapter resolution", () => {
  it("returns 404 when no adapter is registered for the source", async () => {
    const result = await dispatchConnectorRequest(ctx, {
      source: "unknown",
      action: "connect",
    });
    expect(result.status).toBe(404);
    expect(result.body.success).toBe(false);
  });

  it("returns 501 when adapter doesn't implement the requested action", async () => {
    const adapter: ConnectorAdapter = {
      source: "demo",
      connect: vi.fn(async () => ({ success: true })),
    };
    registerAdapter(adapter);
    const result = await dispatchConnectorRequest(ctx, {
      source: "demo",
      action: "sync",
    });
    expect(result.status).toBe(501);
    expect(result.body.error).toMatch(/does not implement action 'sync'/);
  });
});

describe("dispatchConnectorRequest — happy + idempotent paths", () => {
  it("returns 200 + adapter body on success", async () => {
    const adapter: ConnectorAdapter = {
      source: "demo",
      sync: vi.fn(async () => ({
        success: true,
        data: { recordingId: "abc" },
      })),
    };
    registerAdapter(adapter);
    const result = await dispatchConnectorRequest(ctx, {
      source: "demo",
      action: "sync",
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      success: true,
      data: { recordingId: "abc" },
    });
  });

  it("returns 200 when adapter reports skipped (dedup), not 500", async () => {
    // Idempotent dedup contract — every future connector inherits this rule.
    const adapter: ConnectorAdapter = {
      source: "demo",
      sync: vi.fn(async () => ({ success: false, skipped: true })),
    };
    registerAdapter(adapter);
    const result = await dispatchConnectorRequest(ctx, {
      source: "demo",
      action: "sync",
    });
    expect(result.status).toBe(200);
    expect(result.body.skipped).toBe(true);
  });
});

describe("dispatchConnectorRequest — error path", () => {
  it("returns 500 with sanitized error.message when handler throws", async () => {
    const adapter: ConnectorAdapter = {
      source: "demo",
      fetch: vi.fn(async () => {
        throw new Error("network unreachable");
      }),
    };
    registerAdapter(adapter);
    const result = await dispatchConnectorRequest(ctx, {
      source: "demo",
      action: "fetch",
    });
    expect(result.status).toBe(500);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBe("network unreachable");
  });

  it("returns 500 with 'Unknown adapter error' when handler throws a non-Error", async () => {
    const adapter: ConnectorAdapter = {
      source: "demo",
      fetch: vi.fn(async () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "boom";
      }),
    };
    registerAdapter(adapter);
    const result = await dispatchConnectorRequest(ctx, {
      source: "demo",
      action: "fetch",
    });
    expect(result.status).toBe(500);
    expect(result.body.error).toBe("Unknown adapter error");
  });

  it("returns 500 when adapter reports plain failure", async () => {
    const adapter: ConnectorAdapter = {
      source: "demo",
      sync: vi.fn(async () => ({ success: false, error: "vendor down" })),
    };
    registerAdapter(adapter);
    const result = await dispatchConnectorRequest(ctx, {
      source: "demo",
      action: "sync",
    });
    expect(result.status).toBe(500);
    expect(result.body.error).toBe("vendor down");
  });
});

describe("registerAdapter — duplicate guard", () => {
  it("throws when the same source is registered twice", () => {
    registerAdapter({
      source: "demo",
      connect: async () => ({ success: true }),
    });
    expect(() =>
      registerAdapter({
        source: "demo",
        connect: async () => ({ success: true }),
      }),
    ).toThrow(/Adapter already registered for source 'demo'/);
  });
});

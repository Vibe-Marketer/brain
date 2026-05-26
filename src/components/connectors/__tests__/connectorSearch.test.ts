import { describe, expect, it, vi } from "vitest";
import {
  appendUniqueAvailableCalls,
  searchAllAvailableConnectorCalls,
} from "../connectorSearch";
import type { AvailableCall, ConnectorAdapter } from "../registry/types";

function call(externalId: string): AvailableCall {
  return {
    externalId,
    title: `Call ${externalId}`,
    startTime: "2026-05-26T12:00:00.000Z",
    durationSeconds: 120,
    alreadyImported: false,
  };
}

describe("connectorSearch", () => {
  it("appends only calls with new external IDs", () => {
    expect(
      appendUniqueAvailableCalls([call("a"), call("b")], [call("b"), call("c")]).map(
        (item) => item.externalId,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("follows connector cursors up to completion and dedupes repeated items", async () => {
    const searchAvailable = vi
      .fn<NonNullable<ConnectorAdapter["searchAvailable"]>>()
      .mockResolvedValueOnce({ items: [call("a"), call("b")], nextCursor: "page-2" })
      .mockResolvedValueOnce({ items: [call("b"), call("c")], nextCursor: null });

    const result = await searchAllAvailableConnectorCalls({
      searchAvailable,
      sourceId: "source-1",
      dateStart: new Date("2026-05-01T00:00:00.000Z"),
      dateEnd: new Date("2026-05-02T00:00:00.000Z"),
      limit: 50,
    });

    expect(result.map((item) => item.externalId)).toEqual(["a", "b", "c"]);
    expect(searchAvailable).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ cursor: undefined, limit: 50 }),
    );
    expect(searchAvailable).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: "page-2", limit: 50 }),
    );
  });

  it("stops at the configured max page count", async () => {
    const searchAvailable = vi
      .fn<NonNullable<ConnectorAdapter["searchAvailable"]>>()
      .mockResolvedValue({ items: [call("a")], nextCursor: "again" });

    await searchAllAvailableConnectorCalls({
      searchAvailable,
      sourceId: "source-1",
      dateStart: new Date("2026-05-01T00:00:00.000Z"),
      dateEnd: new Date("2026-05-02T00:00:00.000Z"),
      maxPages: 3,
    });

    expect(searchAvailable).toHaveBeenCalledTimes(3);
  });
});

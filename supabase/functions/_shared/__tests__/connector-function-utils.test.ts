import { describe, expect, it } from "vitest";
import {
  ConnectorRequestValidationError,
  getConnectorDateWindow,
  getConnectorDateWindowMs,
  resolveConnectorSyncIds,
} from "../connector-function-utils";

describe("connector-function-utils sync id resolution", () => {
  it("prefers singleCallId over array ids", async () => {
    await expect(
      resolveConnectorSyncIds({
        body: { singleCallId: "one", recordingIds: ["two"] },
        idFields: ["recordingIds"],
        fetchFallbackIds: async () => ["fallback"],
        maxBatchSize: 50,
        emptyError: "empty",
        tooManyError: () => "too many",
      }),
    ).resolves.toEqual(["one"]);
  });

  it("uses the first configured non-empty array id field", async () => {
    await expect(
      resolveConnectorSyncIds({
        body: { meetingIds: ["m1"], recordingIds: ["r1"] },
        idFields: ["meetingIds", "recordingIds"],
        fetchFallbackIds: async () => ["fallback"],
        maxBatchSize: 50,
        emptyError: "empty",
        tooManyError: () => "too many",
      }),
    ).resolves.toEqual(["m1"]);
  });

  it("falls back to date-window discovery when no explicit ids are provided", async () => {
    await expect(
      resolveConnectorSyncIds({
        body: {},
        idFields: ["recordingIds"],
        fetchFallbackIds: async () => ["recent"],
        maxBatchSize: 50,
        emptyError: "empty",
        tooManyError: () => "too many",
      }),
    ).resolves.toEqual(["recent"]);
  });

  it("raises validation errors for empty and oversized batches", async () => {
    await expect(
      resolveConnectorSyncIds({
        body: {},
        idFields: ["recordingIds"],
        fetchFallbackIds: async () => [],
        maxBatchSize: 50,
        emptyError: "empty",
        tooManyError: () => "too many",
      }),
    ).rejects.toBeInstanceOf(ConnectorRequestValidationError);

    await expect(
      resolveConnectorSyncIds({
        body: { recordingIds: ["1", "2"] },
        idFields: ["recordingIds"],
        fetchFallbackIds: async () => [],
        maxBatchSize: 1,
        emptyError: "empty",
        tooManyError: (count, max) => `too many: ${count}/${max}`,
      }),
    ).rejects.toThrow("too many: 2/1");
  });
});

describe("connector-function-utils date window normalization", () => {
  it("prefers provider-neutral createdAfter/createdBefore aliases", () => {
    expect(
      getConnectorDateWindow({
        createdAfter: "2026-05-01T00:00:00Z",
        createdBefore: "2026-05-02T00:00:00Z",
        dateStart: "2026-04-01T00:00:00Z",
        dateEnd: "2026-04-02T00:00:00Z",
      }),
    ).toEqual({
      start: "2026-05-01T00:00:00Z",
      end: "2026-05-02T00:00:00Z",
    });
  });

  it("falls back to UI dateStart/dateEnd aliases and trims blanks", () => {
    expect(
      getConnectorDateWindow({
        createdAfter: " ",
        createdBefore: "",
        dateStart: "2026-05-03T00:00:00Z",
        dateEnd: "2026-05-04T00:00:00Z",
      }),
    ).toEqual({
      start: "2026-05-03T00:00:00Z",
      end: "2026-05-04T00:00:00Z",
    });
  });

  it("returns millisecond timestamps for providers that require numeric bounds", () => {
    expect(
      getConnectorDateWindowMs({
        dateStart: "2026-05-03T00:00:00Z",
        dateEnd: "2026-05-04T00:00:00Z",
      }),
    ).toEqual({
      startMs: Date.parse("2026-05-03T00:00:00Z"),
      endMs: Date.parse("2026-05-04T00:00:00Z"),
    });
  });
});

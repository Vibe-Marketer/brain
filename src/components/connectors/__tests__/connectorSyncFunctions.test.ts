import { describe, expect, it } from "vitest";
import { SOURCE_REGISTRY } from "@/config/source-registry";
import {
  canRetryFailedImport,
  getConnectorSyncFunctionName,
} from "@/lib/connector-sync-functions";

describe("connector sync function contract", () => {
  it("derives sync functions for retry and post-connect dispatch from source registry metadata", () => {
    for (const source of SOURCE_REGISTRY) {
      expect(getConnectorSyncFunctionName(source.id)).toBe(
        source.syncFunctionName ?? null,
      );
    }
  });

  it("returns null for sources that cannot be retried or synced automatically", () => {
    expect(getConnectorSyncFunctionName("file-upload")).toBeNull();
    expect(getConnectorSyncFunctionName("paste-transcript")).toBeNull();
    expect(getConnectorSyncFunctionName("unknown")).toBeNull();
  });

  it("derives failed-import retryability from the sync function contract", () => {
    for (const source of SOURCE_REGISTRY) {
      expect(canRetryFailedImport(source.id)).toBe(
        Boolean(source.syncFunctionName),
      );
    }
  });
});

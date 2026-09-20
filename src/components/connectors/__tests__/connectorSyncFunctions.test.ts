import { describe, expect, it } from "vitest";
import { SOURCE_REGISTRY } from "@/config/source-registry";
import {
  canRetryFailedImport,
  getConnectorSyncFunctionName,
} from "@/lib/connector-sync-functions";

describe("connector sync function contract", () => {

  it("returns null for sources that cannot be retried or synced automatically", () => {
    expect(getConnectorSyncFunctionName("file-upload")).toBeNull();
    expect(getConnectorSyncFunctionName("paste-transcript")).toBeNull();
    expect(getConnectorSyncFunctionName("unknown")).toBeNull();
  });

});

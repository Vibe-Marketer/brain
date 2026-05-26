import { describe, expect, it } from "vitest";
import { SOURCE_REGISTRY } from "@/config/source-registry";
import {
  isConnectorAlwaysAvailable,
  isOAuthConnectorSource,
} from "@/lib/connector-availability";
import type { ConnectorSourceApp } from "@/components/connectors/registry/types";

describe("connector availability", () => {
  it("derives always-available connectors from source auth metadata", () => {
    for (const source of SOURCE_REGISTRY) {
      if (source.id === "paste-transcript") continue;

      expect(isConnectorAlwaysAvailable(source.id as ConnectorSourceApp)).toBe(
        source.authMode === "none" || source.authMode === "public-url",
      );
    }
  });

  it("derives OAuth-backed sources from source auth metadata", () => {
    for (const source of SOURCE_REGISTRY) {
      expect(isOAuthConnectorSource(source.id)).toBe(source.authMode === "oauth2");
    }
  });
});

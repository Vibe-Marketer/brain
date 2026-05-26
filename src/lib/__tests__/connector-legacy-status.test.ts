import { describe, expect, it } from "vitest";
import {
  getLegacyConnectorAccountEmail,
  isLegacyConnectorConnected,
} from "@/lib/connector-legacy-status";

const NOW = 1_780_000_000_000;

describe("connector legacy status", () => {
  it("treats Fathom legacy API key as connected", () => {
    expect(
      isLegacyConnectorConnected({
        sourceApp: "fathom",
        settings: {
          fathom_api_key: "key_123",
          oauth_token_expires: null,
          zoom_oauth_token_expires: null,
        },
        now: NOW,
      }),
    ).toBe(true);
  });

  it("treats future Fathom OAuth expiry as connected", () => {
    expect(
      isLegacyConnectorConnected({
        sourceApp: "fathom",
        settings: {
          fathom_api_key: null,
          oauth_token_expires: NOW + 60_000,
          zoom_oauth_token_expires: null,
        },
        now: NOW,
      }),
    ).toBe(true);
  });

  it("treats future Zoom OAuth expiry as connected", () => {
    expect(
      isLegacyConnectorConnected({
        sourceApp: "zoom",
        settings: {
          fathom_api_key: null,
          oauth_token_expires: null,
          zoom_oauth_token_expires: NOW + 60_000,
        },
        now: NOW,
      }),
    ).toBe(true);
  });

  it("rejects expired legacy OAuth state and unsupported source fallbacks", () => {
    const settings = {
      fathom_api_key: null,
      oauth_token_expires: NOW - 60_000,
      zoom_oauth_token_expires: NOW - 60_000,
    };

    expect(
      isLegacyConnectorConnected({ sourceApp: "fathom", settings, now: NOW }),
    ).toBe(false);
    expect(
      isLegacyConnectorConnected({ sourceApp: "zoom", settings, now: NOW }),
    ).toBe(false);
    expect(
      isLegacyConnectorConnected({ sourceApp: "grain", settings, now: NOW }),
    ).toBe(false);
  });

  it("only exposes legacy host email for Fathom", () => {
    const settings = {
      fathom_api_key: null,
      host_email: "host@example.com",
      oauth_token_expires: null,
      zoom_oauth_token_expires: null,
    };

    expect(
      getLegacyConnectorAccountEmail({ sourceApp: "fathom", settings }),
    ).toBe("host@example.com");
    expect(
      getLegacyConnectorAccountEmail({ sourceApp: "zoom", settings }),
    ).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import {
  getConnectorSetupConfig,
  listConnectorAdapters,
} from "../connectorRegistry";

describe("connector setup metadata", () => {
  it("registers setup metadata for every connector", () => {
    expect(
      Object.fromEntries(
        listConnectorAdapters().map((adapter) => [
          adapter.metadata.sourceApp,
          adapter.setup.kind,
        ]),
      ),
    ).toEqual({
      fathom: "oauth",
      zoom: "oauth",
      fireflies: "api_key_webhook",
      "read-ai": "oauth",
      grain: "oauth",
      plaud: "browser_bridge",
      youtube: "none",
      "file-upload": "none",
    });
  });

  it("keeps Fireflies webhook setup details in adapter metadata", () => {
    const setup = getConnectorSetupConfig("fireflies");

    expect(setup.webhook).toMatchObject({
      required: true,
      providerLabel: "Fireflies",
      urlLabel: "Webhook URL for Fireflies",
      signingSecretLabel: "Webhook signing secret",
      signingSecretField: "webhookSecret",
      destinationPath: "fireflies-webhook",
      pathTokenField: "webhookPathToken",
    });
    expect(setup.webhook?.eventTypes).toEqual([
      "meeting.transcribed",
      "meeting.summarized",
    ]);
    expect(setup.credentialFields?.map((field) => field.name)).toEqual([
      "apiKey",
    ]);
  });

  it("marks Plaud beta setup as browser bridge metadata", () => {
    const setup = getConnectorSetupConfig("plaud");

    expect(setup).toMatchObject({
      kind: "browser_bridge",
      beta: true,
      accountLabelField: "email",
    });
    expect(setup.credentialFields?.map((field) => field.name)).toEqual([
      "apiKey",
      "apiBase",
    ]);
  });
});

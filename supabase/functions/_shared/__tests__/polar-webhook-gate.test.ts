import { describe, expect, it } from "vitest";
import { polarWebhookHttpGate } from "../polar-webhook-gate";

describe("polarWebhookHttpGate", () => {
  it("rejects non-POST methods with 405", () => {
    expect(polarWebhookHttpGate("GET", "secret")).toEqual({
      status: 405,
      error: "Method not allowed",
    });
  });

  it("rejects a missing webhook secret with 500", () => {
    expect(polarWebhookHttpGate("POST", undefined)).toEqual({
      status: 500,
      error: "Webhook secret not configured",
    });
  });

  it("lets a POST with a secret through to signature verification", () => {
    expect(polarWebhookHttpGate("POST", "polar-secret")).toBeNull();
  });
});

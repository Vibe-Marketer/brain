import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWebhookUrl } from "../webhook-url";

describe("buildWebhookUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the configured public webhook base with an /api suffix", () => {
    vi.stubEnv("VITE_PUBLIC_WEBHOOK_BASE_URL", "https://app.callvaultai.com");
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");

    expect(
      buildWebhookUrl({
        destinationPath: "fireflies-webhook",
        pathToken: "ffwh_saved",
      }),
    ).toBe("https://app.callvaultai.com/api/fireflies-webhook/ffwh_saved");
  });

  it("does not duplicate /api when the public base already includes it", () => {
    vi.stubEnv("VITE_PUBLIC_WEBHOOK_BASE_URL", "https://app.callvaultai.com/api/");

    expect(
      buildWebhookUrl({
        destinationPath: "/read-ai-webhook/",
        pathToken: "/rwh_saved/",
      }),
    ).toBe("https://app.callvaultai.com/api/read-ai-webhook/rwh_saved");
  });

  it("keeps the Supabase functions URL as the local fallback", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co/");

    expect(
      buildWebhookUrl({
        destinationPath: "fireflies-webhook",
        pathToken: "ffwh_saved",
      }),
    ).toBe("https://project.supabase.co/functions/v1/fireflies-webhook/ffwh_saved");
  });
});

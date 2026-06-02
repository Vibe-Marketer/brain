import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

vi.mock("@/hooks/useAiGate", () => ({
  useAiGate: () => ({
    trackAction: vi.fn(),
  }),
}));

import { buildFallbackReengagementEmail } from "@/hooks/useHealthAlerts";

describe("buildFallbackReengagementEmail", () => {
  it("creates an editable draft without generated personalization", () => {
    const draft = buildFallbackReengagementEmail({
      name: "Daniel Marama",
      email: "daniel@example.com",
    });

    expect(draft).toMatchObject({
      subject: "Checking in, Daniel Marama",
      generatedBy: "template",
    });
    expect(draft.body).toContain("Hi Daniel Marama");
    expect(draft.body).toContain("I wanted to check in");
  });
});

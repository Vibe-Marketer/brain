import { describe, expect, it } from "vitest";
import { ticketSourceLabel } from "@/lib/ticket-display";

describe("ticketSourceLabel", () => {
  it.each([
    ["manual", "Reported by a person"],
    ["in_app_user", "Reported by a person"],
    ["sentry", "Found by Sentry"],
    ["nightly_qa", "Found by nightly QA"],
    ["internal", "Internal watchdog"],
    ["unknown", "Unknown source"],
  ])("renders %s as %s", (source, label) => {
    expect(ticketSourceLabel(source)).toBe(label);
  });

  it.each([null, undefined, "", "future_source", "nightly-qa"])(
    "renders unknown input as Unknown source",
    (source) => {
      expect(ticketSourceLabel(source)).toBe("Unknown source");
    },
  );
});

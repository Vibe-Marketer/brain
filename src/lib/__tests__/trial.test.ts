import { describe, expect, it } from "vitest";
import {
  formatTrialEndDate,
  getTrialDaysRemaining,
  isActiveProTrial,
  TRIAL_PRODUCT_ID,
} from "@/lib/trial";

describe("trial helpers", () => {
  it("detects an active pro trial", () => {
    expect(
      isActiveProTrial(
        TRIAL_PRODUCT_ID,
        "trialing",
        new Date("2030-01-08T00:00:00Z"),
        new Date("2030-01-01T00:00:00Z"),
      ),
    ).toBe(true);
  });

  it("rejects expired or non-trial subscriptions", () => {
    expect(
      isActiveProTrial(
        TRIAL_PRODUCT_ID,
        "trialing",
        new Date("2030-01-01T00:00:00Z"),
        new Date("2030-01-02T00:00:00Z"),
      ),
    ).toBe(false);
    expect(
      isActiveProTrial(
        "30020903-fa8f-4534-9cf1-6e9fba26584c",
        "active",
        new Date("2030-01-08T00:00:00Z"),
        new Date("2030-01-01T00:00:00Z"),
      ),
    ).toBe(false);
  });

  it("rounds remaining trial time up to whole days", () => {
    expect(
      getTrialDaysRemaining(
        new Date("2030-01-02T00:00:00Z"),
        new Date("2030-01-01T12:00:00Z"),
      ),
    ).toBe(1);
  });

  it("formats a missing end date without throwing", () => {
    expect(formatTrialEndDate(null)).toBe("your trial ends");
  });
});

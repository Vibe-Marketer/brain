import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const badgeSource = readFileSync(
  join(process.cwd(), "src/components/billing/TrialCountdownBadge.tsx"),
  "utf8",
);
const layoutSource = readFileSync(join(process.cwd(), "src/components/Layout.tsx"), "utf8");
const trialPageSource = readFileSync(
  join(process.cwd(), "src/pages/SetupTrialUpsell.tsx"),
  "utf8",
);

describe("TrialCountdownBadge wiring", () => {
  it("shows only for active pro trial users", () => {
    expect(badgeSource).toMatch(/useSubscription/);
    expect(badgeSource).toMatch(/isActiveProTrial\(productId, status, periodEnd\)/);
    expect(badgeSource).toMatch(/getTrialDaysRemaining\(periodEnd\)/);
  });

  it("is mounted in app layout and setup trial page", () => {
    expect(layoutSource).toMatch(/<TrialCountdownBadge \/>/);
    expect(trialPageSource).toMatch(/<TrialCountdownBadge \/>/);
  });
});

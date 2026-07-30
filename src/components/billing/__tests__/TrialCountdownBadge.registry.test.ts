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

  it("is mounted on the setup trial page only, not persisted across the app shell", () => {
    // Removed from Layout.tsx (2026-07-30): a persistent nag badge on every
    // screen was reported as a payment-gate annoyance. The trial upsell page
    // itself (with its own back/skip path) is a legitimate, non-blocking spot.
    expect(layoutSource).not.toMatch(/<TrialCountdownBadge \/>/);
    expect(trialPageSource).toMatch(/<TrialCountdownBadge \/>/);
  });
});

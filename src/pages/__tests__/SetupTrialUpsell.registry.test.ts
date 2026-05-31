import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/pages/SetupTrialUpsell.tsx"), "utf8");
const appSource = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
const setupSource = readFileSync(join(process.cwd(), "src/pages/SetupWizard.tsx"), "utf8");
const checkoutSource = readFileSync(
  join(process.cwd(), "supabase/functions/polar-checkout/index.ts"),
  "utf8",
);

describe("SetupTrialUpsell onboarding routing", () => {
  it("adds a protected no-layout trial route after source setup", () => {
    expect(appSource).toMatch(/path="\/setup\/trial"/);
    expect(appSource).toMatch(/<SetupTrialUpsell \/>/);
    expect(setupSource).toMatch(/navigate\("\/setup\/trial"/);
    expect(setupSource).not.toMatch(/navigate\("\/import",\s*\{\s*replace:\s*true\s*\}\)/);
  });

  it("offers checkout and no-credit-card continuation", () => {
    expect(source).toMatch(/Add payment details/);
    expect(source).toMatch(/Continue without a credit card/);
    expect(source).toMatch(/Skip payment details and continue without a credit card/);
    expect(source).toMatch(/automatically continues on Free/);
  });

  it("keeps trial checkout in the onboarding flow", () => {
    expect(source).toMatch(/successPath="\/import\?trial=checkout"/);
    expect(source).toMatch(/onCheckoutStarted=\{handleCheckoutStarted\}/);
    expect(checkoutSource).toMatch(/successPath/);
    expect(checkoutSource).toMatch(/!successPath\.startsWith\('\/\/'\)/);
  });

  it("includes a team trial path without changing connector behavior", () => {
    expect(source).toMatch(/Set up team trial/);
    expect(source).toMatch(/\/organization\?trial=team/);
    expect(source).not.toMatch(/plaud/i);
    expect(source).not.toMatch(/grain/i);
  });
});

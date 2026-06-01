import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LockedFeatureButton } from "@/components/billing/LockedFeatureButton";

const capturedSuccessPaths: Array<string | undefined> = [];

vi.mock("@/components/billing/UpgradeButton", () => ({
  UpgradeButton: ({
    children,
    successPath,
  }: {
    children: React.ReactNode;
    successPath?: string;
  }) => {
    capturedSuccessPaths.push(successPath);
    return (
      <button data-testid="mock-upgrade-button" data-success-path={successPath}>
        {children}
      </button>
    );
  },
}));

describe("LockedFeatureButton paywall gate", () => {
  beforeEach(() => {
    capturedSuccessPaths.length = 0;
    window.history.replaceState({}, "", "/settings?tab=mcp");
  });

  it("opens paywall and passes route-preserving successPath with action marker", () => {
    render(
      <LockedFeatureButton
        description="Connect AI clients with OAuth from this tab."
        upgradeProductId="pro-monthly"
        upgradeLabel="Upgrade to Pro"
        actionMarker="mcp-connect-ai-client"
      >
        Connect AI client
      </LockedFeatureButton>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Connect AI client/i }));

    expect(screen.getByText("Upgrade to keep going")).toBeInTheDocument();
    const upgrade = screen.getByTestId("mock-upgrade-button");
    const successPath = upgrade.getAttribute("data-success-path");
    expect(successPath?.startsWith("/settings?tab=mcp")).toBe(true);
    expect(successPath).toContain("paywall_action=mcp-connect-ai-client");
    expect(capturedSuccessPaths[capturedSuccessPaths.length - 1]).toBe(successPath ?? undefined);
  });
});

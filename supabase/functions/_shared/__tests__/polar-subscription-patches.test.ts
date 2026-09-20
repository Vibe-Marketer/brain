import { describe, expect, it } from "vitest";
import {
  polarCanceledProfilePatch,
  polarRevokedProfilePatch,
} from "../polar-subscription-patches";

describe("Polar subscription access patches", () => {
  it("canceled only flips status — period end / subscription id stay for remaining access", () => {
    const patch = polarCanceledProfilePatch();
    expect(patch).toEqual({ subscription_status: "canceled" });
    expect(patch).not.toHaveProperty("subscription_id");
    expect(patch).not.toHaveProperty("current_period_end");
    expect(patch).not.toHaveProperty("product_id");
  });

  it("revoked clears subscription fields for immediate access loss", () => {
    expect(polarRevokedProfilePatch()).toEqual({
      subscription_id: null,
      subscription_status: "revoked",
      product_id: null,
      current_period_end: null,
    });
  });
});

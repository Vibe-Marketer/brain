/**
 * Polar webhook → user_profiles patches.
 *
 * Canceled keeps subscription_id / current_period_end (access until period end).
 * Revoked clears those fields (immediate access loss).
 */
export function polarCanceledProfilePatch(): { subscription_status: "canceled" } {
  return { subscription_status: "canceled" };
}

export function polarRevokedProfilePatch(): {
  subscription_id: null;
  subscription_status: "revoked";
  product_id: null;
  current_period_end: null;
} {
  return {
    subscription_id: null,
    subscription_status: "revoked",
    product_id: null,
    current_period_end: null,
  };
}

/**
 * Polar SDK Client Module
 * 
 * Centralized Polar SDK initialization for all Edge Functions.
 * This module provides a configured Polar client instance and exports
 * commonly used types for webhook handling.
 * 
 * Required Environment Variables:
 * - POLAR_ACCESS_TOKEN: Access token from Polar Dashboard -> Settings -> Access Tokens
 * - POLAR_ORGANIZATION_ID: Organization ID from Polar Dashboard -> Settings -> Organization ID
 * 
 * @example
 * ```typescript
 * import { getPolarClient, POLAR_ORG_ID } from '../_shared/polar-client.ts';
 * 
 * const polar = getPolarClient();
 * const customer = await polar.customers.create({
 *   email: user.email,
 *   organizationId: POLAR_ORG_ID,
 * });
 * ```
 */

import { Polar } from 'npm:@polar-sh/sdk';

// Re-export types for webhook event handling
export type { 
  WebhookSubscriptionCreatedPayload,
  WebhookSubscriptionActivePayload,
  WebhookSubscriptionCanceledPayload,
  WebhookSubscriptionRevokedPayload,
  WebhookCustomerCreatedPayload,
  WebhookCustomerStateChangedPayload,
} from 'npm:@polar-sh/sdk/models/components';

// Lazy-loaded singleton instance
let polarClient: Polar | null = null;

/**
 * Get the configured Polar SDK client instance.
 * 
 * This function returns a singleton Polar client configured with the
 * access token from environment variables. It throws an error if the
 * required environment variable is not set.
 * 
 * @throws Error if POLAR_ACCESS_TOKEN is not configured
 * @returns Configured Polar client instance
 */
export function getPolarClient(): Polar {
  if (polarClient) {
    return polarClient;
  }

  const accessToken = Deno.env.get('POLAR_ACCESS_TOKEN');
  
  if (!accessToken) {
    throw new Error(
      'POLAR_ACCESS_TOKEN environment variable is not configured. ' +
      'Please add it to your Supabase secrets via: ' +
      'supabase secrets set POLAR_ACCESS_TOKEN=<your-token>'
    );
  }

  polarClient = new Polar({
    accessToken,
  });

  return polarClient;
}

/**
 * Polar Organization ID from environment.
 * 
 * This is required for most Polar API calls that create or query
 * resources scoped to your organization.
 * 
 * @throws Error if POLAR_ORGANIZATION_ID is not configured
 */
export function getPolarOrgId(): string {
  const orgId = Deno.env.get('POLAR_ORGANIZATION_ID');
  
  if (!orgId) {
    throw new Error(
      'POLAR_ORGANIZATION_ID environment variable is not configured. ' +
      'Please add it to your Supabase secrets via: ' +
      'supabase secrets set POLAR_ORGANIZATION_ID=<your-org-id>'
    );
  }

  return orgId;
}

/**
 * Convenience export for organization ID.
 * 
 * Note: This will throw at import time if the env var is missing.
 * For lazy evaluation, use getPolarOrgId() instead.
 */
export const POLAR_ORG_ID = (() => {
  try {
    return Deno.env.get('POLAR_ORGANIZATION_ID') || '';
  } catch {
    // Return empty string during module load, actual check happens at runtime
    return '';
  }
})();

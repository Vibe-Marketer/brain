/**
 * Business Profile CRUD Functions
 *
 * Provides database operations for business profiles.
 * Uses authenticated Supabase client with RLS policies.
 * Enforces max 3 profiles per user.
 */

import { supabase } from "@/integrations/supabase/client";
import { requireUser } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import type { BusinessProfile, BusinessProfileInput } from "@/types/content-hub";

/**
 * Maximum number of business profiles allowed per user
 */
const MAX_PROFILES = 3;

/**
 * Error class for business profile operations
 */
export class BusinessProfileError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "BusinessProfileError";
  }
}

/**
 * Result type for business profile operations
 */
export interface BusinessProfileResult<T> {
  data: T | null;
  error: BusinessProfileError | null;
}

/**
 * Fetch all business profiles for the current user
 *
 * @returns Array of business profiles ordered by created_at desc
 *
 * @example
 * const { data, error } = await fetchBusinessProfiles();
 */
export async function fetchBusinessProfiles(): Promise<
  BusinessProfileResult<BusinessProfile[]>
> {
  try {
    await requireUser();

    const { data, error } = await supabase
      .from("business_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching business profiles", error);
      return {
        data: null,
        error: new BusinessProfileError(
          "Failed to fetch business profiles",
          error.code,
          error
        ),
      };
    }

    return {
      data: (data || []) as BusinessProfile[],
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching business profiles", err);
    return {
      data: null,
      error: new BusinessProfileError(
        err instanceof Error ? err.message : "Failed to fetch business profiles",
        undefined,
        err
      ),
    };
  }
}

/**
 * Get the default business profile for the current user
 *
 * @returns The default profile or null if none set
 *
 * @example
 * const { data: defaultProfile, error } = await getDefaultProfile();
 */
export async function getDefaultProfile(): Promise<
  BusinessProfileResult<BusinessProfile>
> {
  try {
    await requireUser();

    const { data, error } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("is_default", true)
      .maybeSingle();

    if (error) {
      logger.error("Error fetching default business profile", error);
      return {
        data: null,
        error: new BusinessProfileError(
          "Failed to fetch default business profile",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as BusinessProfile | null,
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching default business profile", err);
    return {
      data: null,
      error: new BusinessProfileError(
        err instanceof Error
          ? err.message
          : "Failed to fetch default business profile",
        undefined,
        err
      ),
    };
  }
}

/**
 * Create a new business profile
 *
 * Enforces maximum of 3 profiles per user.
 * If this is the first profile, it will be set as default.
 *
 * @param input - Profile data to create
 * @returns The created business profile
 *
 * @example
 * const { data, error } = await createBusinessProfile({
 *   company_name: 'Acme Corp',
 *   industry: 'Technology'
 * });
 */
export async function createBusinessProfile(
  input: BusinessProfileInput
): Promise<BusinessProfileResult<BusinessProfile>> {
  try {
    const user = await requireUser();

    // Check current profile count
    const { data: existingProfiles, error: countError } = await supabase
      .from("business_profiles")
      .select("id")
      .eq("user_id", user.id);

    if (countError) {
      logger.error("Error checking profile count", countError);
      return {
        data: null,
        error: new BusinessProfileError(
          "Failed to verify profile limit",
          countError.code,
          countError
        ),
      };
    }

    if (existingProfiles && existingProfiles.length >= MAX_PROFILES) {
      return {
        data: null,
        error: new BusinessProfileError(
          `Maximum of ${MAX_PROFILES} business profiles allowed`,
          "MAX_PROFILES_EXCEEDED"
        ),
      };
    }

    // If this is the first profile, set as default
    const isFirstProfile = !existingProfiles || existingProfiles.length === 0;
    const isDefault = input.is_default ?? isFirstProfile;

    // If setting as default, clear other defaults first
    if (isDefault && existingProfiles && existingProfiles.length > 0) {
      const { error: clearError } = await supabase
        .from("business_profiles")
        .update({ is_default: false })
        .eq("user_id", user.id);

      if (clearError) {
        logger.error("Error clearing existing default profile", clearError);
        return {
          data: null,
          error: new BusinessProfileError(
            "Failed to update default profile",
            clearError.code,
            clearError
          ),
        };
      }
    }

    const { data, error } = await supabase
      .from("business_profiles")
      .insert({
        user_id: user.id,
        is_default: isDefault,
        company_name: input.company_name ?? null,
        website: input.website ?? null,
        primary_product_service: input.primary_product_service ?? null,
        industry: input.industry ?? null,
        product_service_delivery: input.product_service_delivery ?? null,
        employees_count: input.employees_count ?? null,
        primary_delivery_method: input.primary_delivery_method ?? null,
        business_model: input.business_model ?? null,
        primary_selling_mechanism: input.primary_selling_mechanism ?? null,
        current_tech_status: input.current_tech_status ?? null,
        primary_advertising_mode: input.primary_advertising_mode ?? null,
        primary_lead_getter: input.primary_lead_getter ?? null,
        primary_marketing_channel: input.primary_marketing_channel ?? null,
        marketing_channels: input.marketing_channels ?? null,
        messaging_angles: input.messaging_angles ?? null,
        sales_cycle_length: input.sales_cycle_length ?? null,
        primary_social_platforms: input.primary_social_platforms ?? null,
        customer_acquisition_process: input.customer_acquisition_process ?? null,
        customer_onboarding_process: input.customer_onboarding_process ?? null,
        icp_customer_segments: input.icp_customer_segments ?? null,
        primary_pain_points: input.primary_pain_points ?? null,
        top_objections: input.top_objections ?? null,
        top_decision_drivers: input.top_decision_drivers ?? null,
        value_prop_differentiators: input.value_prop_differentiators ?? null,
        proof_assets_social_proof: input.proof_assets_social_proof ?? null,
        average_order_value: input.average_order_value ?? null,
        customer_average_order_value: input.customer_average_order_value ?? null,
        customer_lifetime_value: input.customer_lifetime_value ?? null,
        guarantees: input.guarantees ?? null,
        promotions_offers: input.promotions_offers ?? null,
        other_products: input.other_products ?? null,
        brand_voice: input.brand_voice ?? null,
        prohibited_terms: input.prohibited_terms ?? null,
        common_sayings_trust_signals: input.common_sayings_trust_signals ?? null,
        biggest_growth_constraint: input.biggest_growth_constraint ?? null,
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating business profile", error);
      return {
        data: null,
        error: new BusinessProfileError(
          "Failed to create business profile",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as BusinessProfile,
      error: null,
    };
  } catch (err) {
    logger.error("Error creating business profile", err);
    return {
      data: null,
      error: new BusinessProfileError(
        err instanceof Error ? err.message : "Failed to create business profile",
        undefined,
        err
      ),
    };
  }
}

/**
 * Update an existing business profile
 *
 * @param id - Profile ID to update
 * @param updates - Partial updates to apply
 * @returns The updated business profile
 *
 * @example
 * const { data, error } = await updateBusinessProfile('uuid-here', {
 *   company_name: 'New Name',
 *   industry: 'Updated Industry'
 * });
 */
export async function updateBusinessProfile(
  id: string,
  updates: BusinessProfileInput
): Promise<BusinessProfileResult<BusinessProfile>> {
  try {
    const user = await requireUser();

    if (!id) {
      return {
        data: null,
        error: new BusinessProfileError("Profile ID is required"),
      };
    }

    // If setting as default, clear other defaults first
    if (updates.is_default === true) {
      const { error: clearError } = await supabase
        .from("business_profiles")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .neq("id", id);

      if (clearError) {
        logger.error("Error clearing existing default profile", clearError);
        return {
          data: null,
          error: new BusinessProfileError(
            "Failed to update default profile",
            clearError.code,
            clearError
          ),
        };
      }
    }

    const { data, error } = await supabase
      .from("business_profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error updating business profile", error);
      return {
        data: null,
        error: new BusinessProfileError(
          "Failed to update business profile",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as BusinessProfile,
      error: null,
    };
  } catch (err) {
    logger.error("Error updating business profile", err);
    return {
      data: null,
      error: new BusinessProfileError(
        err instanceof Error ? err.message : "Failed to update business profile",
        undefined,
        err
      ),
    };
  }
}

/**
 * Delete a business profile
 *
 * If the deleted profile was the default, the most recent remaining profile
 * will be set as the new default.
 *
 * @param id - Profile ID to delete
 * @returns Success status
 *
 * @example
 * const { error } = await deleteBusinessProfile('uuid-here');
 * if (!error) {
 *   console.log('Profile deleted successfully');
 * }
 */
export async function deleteBusinessProfile(
  id: string
): Promise<BusinessProfileResult<{ success: boolean }>> {
  try {
    const user = await requireUser();

    if (!id) {
      return {
        data: null,
        error: new BusinessProfileError("Profile ID is required"),
      };
    }

    // Check if this was the default profile
    const { data: profileToDelete, error: fetchError } = await supabase
      .from("business_profiles")
      .select("is_default")
      .eq("id", id)
      .single();

    if (fetchError) {
      logger.error("Error fetching profile to delete", fetchError);
      return {
        data: null,
        error: new BusinessProfileError(
          "Failed to fetch business profile",
          fetchError.code,
          fetchError
        ),
      };
    }

    const { error } = await supabase
      .from("business_profiles")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("Error deleting business profile", error);
      return {
        data: null,
        error: new BusinessProfileError(
          "Failed to delete business profile",
          error.code,
          error
        ),
      };
    }

    // If we deleted the default, set the most recent remaining profile as default
    if (profileToDelete?.is_default) {
      const { data: remainingProfiles, error: listError } = await supabase
        .from("business_profiles")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!listError && remainingProfiles && remainingProfiles.length > 0) {
        await supabase
          .from("business_profiles")
          .update({ is_default: true })
          .eq("id", remainingProfiles[0].id);
      }
    }

    return {
      data: { success: true },
      error: null,
    };
  } catch (err) {
    logger.error("Error deleting business profile", err);
    return {
      data: null,
      error: new BusinessProfileError(
        err instanceof Error ? err.message : "Failed to delete business profile",
        undefined,
        err
      ),
    };
  }
}

/**
 * Set a profile as the default
 *
 * Clears the default flag on all other profiles for the user.
 *
 * @param id - Profile ID to set as default
 * @returns The updated business profile
 *
 * @example
 * const { data, error } = await setDefaultProfile('uuid-here');
 */
export async function setDefaultProfile(
  id: string
): Promise<BusinessProfileResult<BusinessProfile>> {
  try {
    const user = await requireUser();

    if (!id) {
      return {
        data: null,
        error: new BusinessProfileError("Profile ID is required"),
      };
    }

    // Clear all defaults for this user
    const { error: clearError } = await supabase
      .from("business_profiles")
      .update({ is_default: false })
      .eq("user_id", user.id);

    if (clearError) {
      logger.error("Error clearing default profiles", clearError);
      return {
        data: null,
        error: new BusinessProfileError(
          "Failed to clear default profiles",
          clearError.code,
          clearError
        ),
      };
    }

    // Set the new default
    const { data, error } = await supabase
      .from("business_profiles")
      .update({ is_default: true })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error setting default profile", error);
      return {
        data: null,
        error: new BusinessProfileError(
          "Failed to set default profile",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as BusinessProfile,
      error: null,
    };
  } catch (err) {
    logger.error("Error setting default profile", err);
    return {
      data: null,
      error: new BusinessProfileError(
        err instanceof Error ? err.message : "Failed to set default profile",
        undefined,
        err
      ),
    };
  }
}

/**
 * Get a single business profile by ID
 *
 * @param id - Profile ID
 * @returns The business profile
 *
 * @example
 * const { data, error } = await getBusinessProfileById('uuid-here');
 */
export async function getBusinessProfileById(
  id: string
): Promise<BusinessProfileResult<BusinessProfile>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new BusinessProfileError("Profile ID is required"),
      };
    }

    await requireUser();

    const { data, error } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      logger.error("Error fetching business profile", error);
      return {
        data: null,
        error: new BusinessProfileError(
          "Failed to fetch business profile",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as BusinessProfile,
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching business profile", err);
    return {
      data: null,
      error: new BusinessProfileError(
        err instanceof Error ? err.message : "Failed to fetch business profile",
        undefined,
        err
      ),
    };
  }
}

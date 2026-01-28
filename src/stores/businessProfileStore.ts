import { create } from 'zustand';
import { toast } from 'sonner';
import type { BusinessProfile, BusinessProfileInput } from '@/types/content-hub';
import {
  fetchBusinessProfiles,
  createBusinessProfile,
  updateBusinessProfile,
  deleteBusinessProfile,
  setDefaultProfile,
} from '@/lib/business-profile';

/**
 * Business Profile Store State
 */
interface BusinessProfileState {
  // Profiles list
  profiles: BusinessProfile[];
  profilesLoading: boolean;
  profilesError: string | null;

  // Selected profile for wizard
  selectedProfileId: string | null;
}

/**
 * Business Profile Store Actions
 */
interface BusinessProfileActions {
  // CRUD actions
  fetchProfiles: () => Promise<void>;
  createProfile: (input: BusinessProfileInput) => Promise<BusinessProfile | null>;
  updateProfile: (
    id: string,
    updates: BusinessProfileInput
  ) => Promise<BusinessProfile | null>;
  deleteProfile: (id: string) => Promise<boolean>;
  setAsDefault: (id: string) => Promise<BusinessProfile | null>;

  // Selection
  selectProfile: (id: string | null) => void;

  // Reset
  reset: () => void;
}

/**
 * Initial state for the business profile store
 */
const initialState: BusinessProfileState = {
  profiles: [],
  profilesLoading: false,
  profilesError: null,
  selectedProfileId: null,
};

/**
 * Business Profile Zustand Store
 *
 * Manages state for business profiles used in content generation.
 * Provides CRUD operations with optimistic updates.
 */
export const useBusinessProfileStore = create<
  BusinessProfileState & BusinessProfileActions
>((set, get) => ({
  // Initial state
  ...initialState,

  // Fetch all profiles
  fetchProfiles: async () => {
    set({ profilesLoading: true, profilesError: null });

    const { data, error } = await fetchBusinessProfiles();

    if (error) {
      set({
        profilesLoading: false,
        profilesError: error.message,
      });
      return;
    }

    set({
      profiles: data || [],
      profilesLoading: false,
      profilesError: null,
    });
  },

  // Create a new profile with optimistic update
  createProfile: async (input: BusinessProfileInput) => {
    // Optimistic update - add a temporary profile with a placeholder ID
    const tempId = `temp-${Date.now()}`;
    const existingProfiles = get().profiles;
    const isFirst = existingProfiles.length === 0;

    const tempProfile: BusinessProfile = {
      id: tempId,
      user_id: '', // Will be set by database
      is_default: input.is_default ?? isFirst,
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // If setting as default, update other profiles optimistically
    let optimisticProfiles = existingProfiles;
    if (tempProfile.is_default) {
      optimisticProfiles = existingProfiles.map((p) => ({
        ...p,
        is_default: false,
      }));
    }

    set((state) => ({
      profiles: [tempProfile, ...optimisticProfiles],
    }));

    const { data, error } = await createBusinessProfile(input);

    if (error) {
      // Rollback optimistic update
      set({
        profiles: existingProfiles,
        profilesError: error.message,
      });
      toast.error("Couldn't create business profile. Please try again.");
      return null;
    }

    // Replace temp profile with real profile
    set((state) => ({
      profiles: state.profiles.map((profile) =>
        profile.id === tempId ? data! : profile
      ),
      profilesError: null,
    }));

    return data;
  },

  // Update a profile with optimistic update
  updateProfile: async (id: string, updates: BusinessProfileInput) => {
    const previousProfiles = get().profiles;

    // Optimistic update
    let updatedProfiles = previousProfiles.map((profile) =>
      profile.id === id
        ? { ...profile, ...updates, updated_at: new Date().toISOString() }
        : profile
    );

    // If setting as default, update other profiles
    if (updates.is_default === true) {
      updatedProfiles = updatedProfiles.map((p) => ({
        ...p,
        is_default: p.id === id,
      }));
    }

    set({ profiles: updatedProfiles });

    const { data, error } = await updateBusinessProfile(id, updates);

    if (error) {
      // Rollback optimistic update
      set({
        profiles: previousProfiles,
        profilesError: error.message,
      });
      toast.error("Couldn't update business profile. Please try again.");
      return null;
    }

    // Replace with server response
    set((state) => ({
      profiles: state.profiles.map((profile) =>
        profile.id === id ? data! : profile
      ),
      profilesError: null,
    }));

    return data;
  },

  // Delete a profile with optimistic update
  deleteProfile: async (id: string) => {
    const previousProfiles = get().profiles;
    const profileToDelete = previousProfiles.find((p) => p.id === id);

    // Optimistic update - remove profile from list
    let updatedProfiles = previousProfiles.filter((profile) => profile.id !== id);

    // If deleted profile was default, set most recent as default
    if (profileToDelete?.is_default && updatedProfiles.length > 0) {
      updatedProfiles = updatedProfiles.map((p, index) => ({
        ...p,
        is_default: index === 0, // First profile (most recent) becomes default
      }));
    }

    set({ profiles: updatedProfiles });

    // Clear selection if deleted profile was selected
    if (get().selectedProfileId === id) {
      set({ selectedProfileId: null });
    }

    const { error } = await deleteBusinessProfile(id);

    if (error) {
      // Rollback optimistic update
      set({
        profiles: previousProfiles,
        profilesError: error.message,
      });
      toast.error("Couldn't delete business profile. Please try again.");
      return false;
    }

    return true;
  },

  // Set a profile as default with optimistic update
  setAsDefault: async (id: string) => {
    const previousProfiles = get().profiles;

    // Optimistic update - set this profile as default, others as non-default
    set((state) => ({
      profiles: state.profiles.map((profile) => ({
        ...profile,
        is_default: profile.id === id,
      })),
    }));

    const { data, error } = await setDefaultProfile(id);

    if (error) {
      // Rollback optimistic update
      set({
        profiles: previousProfiles,
        profilesError: error.message,
      });
      toast.error("Couldn't set default profile. Please try again.");
      return null;
    }

    // Replace with server response
    set((state) => ({
      profiles: state.profiles.map((profile) =>
        profile.id === id ? data! : profile
      ),
      profilesError: null,
    }));

    return data;
  },

  // Select a profile for the wizard
  selectProfile: (id: string | null) => {
    set({ selectedProfileId: id });
  },

  // Reset store to initial state
  reset: () => {
    set(initialState);
  },
}));

/**
 * Selector hooks for common use cases
 */
export const useProfiles = () =>
  useBusinessProfileStore((state) => state.profiles);

export const useProfilesLoading = () =>
  useBusinessProfileStore((state) => state.profilesLoading);

export const useProfilesError = () =>
  useBusinessProfileStore((state) => state.profilesError);

export const useDefaultProfile = () =>
  useBusinessProfileStore((state) =>
    state.profiles.find((profile) => profile.is_default) ?? null
  );

export const useSelectedProfile = () =>
  useBusinessProfileStore((state) => {
    if (!state.selectedProfileId) return null;
    return state.profiles.find((p) => p.id === state.selectedProfileId) ?? null;
  });

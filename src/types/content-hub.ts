/**
 * Content Hub type definitions
 * Types for Business Profiles, Insights, Hooks, Content Items, and Wizard State
 * Fields match Supabase schema (snake_case)
 */

// ============================================================================
// ENUMS & TYPE ALIASES
// ============================================================================

/**
 * Product/Service delivery method options
 */
export type ProductServiceDelivery = 'Software' | 'Info services' | 'Physical products';

/**
 * Primary delivery method options
 */
export type PrimaryDeliveryMethod = 'DIY' | 'Done with you' | 'Done for you';

/**
 * Business model options
 */
export type BusinessModel = 'Low-volume high-ticket' | 'High-volume low-ticket' | 'One-time';

/**
 * Primary selling mechanism options
 */
export type PrimarySellingMechanism =
  | 'In-person self-checkout'
  | 'In-person salesperson'
  | 'Online self-checkout'
  | 'Online salesperson';

/**
 * Primary advertising mode options
 */
export type PrimaryAdvertisingMode = 'Warm outreach' | 'Cold outreach' | 'Free content' | 'Paid ads';

/**
 * Primary lead getter options
 */
export type PrimaryLeadGetter = 'Themselves or employees' | 'Referrals' | 'Agencies' | 'Affiliates';

/**
 * Insight category from Agent 2 output
 */
export type InsightCategory =
  | 'pain'
  | 'dream_outcome'
  | 'objection_or_fear'
  | 'story_or_analogy'
  | 'expert_framework';

/**
 * Emotion category for insights and hooks
 */
export type EmotionCategory =
  | 'anger_outrage'
  | 'awe_surprise'
  | 'social_currency'
  | 'relatable'
  | 'practical_value'
  | 'humor_sharp'
  | 'neutral';

/**
 * Hook status in the library
 */
export type HookStatus = 'generated' | 'selected' | 'archived';

/**
 * Content item type - post or email
 */
export type ContentItemType = 'post' | 'email';

/**
 * Content item status
 */
export type ContentItemStatus = 'draft' | 'used';

/**
 * Wizard step identifiers
 */
export type WizardStep = 'select-sources' | 'extract-analyze' | 'generate-hooks' | 'create-content';

/**
 * Agent processing status
 */
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error';

// ============================================================================
// BUSINESS PROFILE
// ============================================================================

/**
 * Business profile - 34 fields for AI content personalization
 * Matches business_profiles table
 */
export interface BusinessProfile {
  id: string;
  user_id: string;
  is_default: boolean;

  // Company & Product (5 fields)
  company_name: string | null;
  website: string | null;
  primary_product_service: string | null;
  industry: string | null;
  product_service_delivery: ProductServiceDelivery | null;

  // Business Model & Operations (5 fields)
  employees_count: number | null;
  primary_delivery_method: PrimaryDeliveryMethod | null;
  business_model: BusinessModel | null;
  primary_selling_mechanism: PrimarySellingMechanism | null;
  current_tech_status: string | null;

  // Marketing & Sales (7 fields)
  primary_advertising_mode: PrimaryAdvertisingMode | null;
  primary_lead_getter: PrimaryLeadGetter | null;
  primary_marketing_channel: string | null;
  marketing_channels: string | null;
  messaging_angles: string | null;
  sales_cycle_length: number | null;
  primary_social_platforms: string | null;

  // Customer Acquisition & Onboarding (2 fields)
  customer_acquisition_process: string | null;
  customer_onboarding_process: string | null;

  // Customer Insights (4 fields)
  icp_customer_segments: string | null;
  primary_pain_points: string | null;
  top_objections: string | null;
  top_decision_drivers: string | null;

  // Value Proposition (2 fields)
  value_prop_differentiators: string | null;
  proof_assets_social_proof: string | null;

  // Offers & Products (6 fields)
  average_order_value: number | null;
  customer_average_order_value: number | null;
  customer_lifetime_value: number | null;
  guarantees: string | null;
  promotions_offers: string | null;
  other_products: string | null;

  // Brand & Voice (3 fields)
  brand_voice: string | null;
  prohibited_terms: string | null;
  common_sayings_trust_signals: string | null;

  // Growth (1 field)
  biggest_growth_constraint: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Input type for creating/updating business profiles
 */
export interface BusinessProfileInput {
  company_name?: string | null;
  website?: string | null;
  primary_product_service?: string | null;
  industry?: string | null;
  product_service_delivery?: ProductServiceDelivery | null;
  employees_count?: number | null;
  primary_delivery_method?: PrimaryDeliveryMethod | null;
  business_model?: BusinessModel | null;
  primary_selling_mechanism?: PrimarySellingMechanism | null;
  current_tech_status?: string | null;
  primary_advertising_mode?: PrimaryAdvertisingMode | null;
  primary_lead_getter?: PrimaryLeadGetter | null;
  primary_marketing_channel?: string | null;
  marketing_channels?: string | null;
  messaging_angles?: string | null;
  sales_cycle_length?: number | null;
  primary_social_platforms?: string | null;
  customer_acquisition_process?: string | null;
  customer_onboarding_process?: string | null;
  icp_customer_segments?: string | null;
  primary_pain_points?: string | null;
  top_objections?: string | null;
  top_decision_drivers?: string | null;
  value_prop_differentiators?: string | null;
  proof_assets_social_proof?: string | null;
  average_order_value?: number | null;
  customer_average_order_value?: number | null;
  customer_lifetime_value?: number | null;
  guarantees?: string | null;
  promotions_offers?: string | null;
  other_products?: string | null;
  brand_voice?: string | null;
  prohibited_terms?: string | null;
  common_sayings_trust_signals?: string | null;
  biggest_growth_constraint?: string | null;
  is_default?: boolean;
}

// ============================================================================
// INSIGHT (Agent 2 Output)
// ============================================================================

/**
 * Insight extracted from call transcripts
 * Matches insights table - internal, not directly exposed in UI
 */
export interface Insight {
  id: string;
  user_id: string;
  recording_id: number;
  category: InsightCategory;
  exact_quote: string;
  speaker: string | null;
  timestamp: string | null;
  why_it_matters: string | null;
  score: number; // 1-5
  emotion_category: EmotionCategory | null;
  virality_score: number | null; // 1-5
  topic_hint: string | null;
  created_at: string;
}

/**
 * Input for creating insights from Agent 2
 */
export interface InsightInput {
  recording_id: number;
  category: InsightCategory;
  exact_quote: string;
  speaker?: string | null;
  timestamp?: string | null;
  why_it_matters?: string | null;
  score: number;
  emotion_category?: EmotionCategory | null;
  virality_score?: number | null;
  topic_hint?: string | null;
}

// ============================================================================
// HOOK (Agent 3 Output)
// ============================================================================

/**
 * Hook generated from insights
 * Matches hooks table - user-facing library
 */
export interface Hook {
  id: string;
  user_id: string;
  recording_id: number | null;
  hook_text: string;
  insight_ids: string[];
  emotion_category: EmotionCategory | null;
  virality_score: number | null; // 1-5
  topic_hint: string | null;
  is_starred: boolean;
  status: HookStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating hooks from Agent 3
 */
export interface HookInput {
  recording_id?: number | null;
  hook_text: string;
  insight_ids?: string[];
  emotion_category?: EmotionCategory | null;
  virality_score?: number | null;
  topic_hint?: string | null;
  is_starred?: boolean;
  status?: HookStatus;
}

/**
 * Filter options for hooks library
 */
export interface HookFilters {
  emotion_category?: EmotionCategory | null;
  virality_score_min?: number | null;
  virality_score_max?: number | null;
  topic_hint?: string | null;
  is_starred?: boolean | null;
  status?: HookStatus | null;
  search?: string;
}

// ============================================================================
// CONTENT ITEM (Agent 4 Output)
// ============================================================================

/**
 * Content item - post or email
 * Matches content_items table - user-facing library
 */
export interface ContentItem {
  id: string;
  user_id: string;
  hook_id: string | null;
  content_type: ContentItemType;
  content_text: string;
  email_subject: string | null; // Only for emails
  status: ContentItemStatus;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating content items from Agent 4
 */
export interface ContentItemInput {
  hook_id?: string | null;
  content_type: ContentItemType;
  content_text: string;
  email_subject?: string | null;
  status?: ContentItemStatus;
}

/**
 * Filter options for content items library
 */
export interface ContentItemFilters {
  content_type?: ContentItemType | null;
  status?: ContentItemStatus | null;
  search?: string;
}

// ============================================================================
// AGENT PIPELINE TYPES
// ============================================================================

/**
 * Agent 1 Classification Result
 */
export interface ClassificationResult {
  call_type: 'sales' | 'onboarding' | 'coaching' | 'support' | 'other';
  stage: 'top' | 'middle' | 'bottom' | 'n/a';
  outcome: 'closed' | 'no' | 'maybe' | 'existing_client' | 'n/a';
  emotional_intensity: number; // 1-5
  content_potential: number; // 1-5
  mine_for_content: boolean;
  notes?: string;
}

/**
 * Agent 2 Insight Miner Result
 */
export interface InsightMinerResult {
  insights: InsightInput[];
  summary?: string;
}

/**
 * Agent 3 Hook Generator Result
 */
export interface HookGeneratorResult {
  hooks: HookInput[];
}

/**
 * Agent 4 Content Builder Result (per hook)
 */
export interface ContentBuilderResult {
  hook_id: string;
  social_post_text: string;
  email_subject: string;
  email_body_opening: string;
}

/**
 * Streaming content state during generation
 */
export interface StreamingContent {
  hook_id: string;
  social_post_text: string;
  email_subject: string;
  email_body_opening: string;
  is_streaming: boolean;
  is_saved: boolean;
}

// ============================================================================
// WIZARD STATE
// ============================================================================

/**
 * Full wizard state for content generation
 */
export interface ContentWizardState {
  // Current step
  current_step: WizardStep;

  // Step 1: Sources
  selected_calls: number[];
  selected_profile_id: string | null;

  // Agent statuses
  classification_status: AgentStatus;
  insights_status: AgentStatus;
  hooks_status: AgentStatus;
  content_status: AgentStatus;

  // Results
  classification_result: ClassificationResult | null;
  generated_insights: Insight[];
  generated_hooks: Hook[];
  selected_hook_ids: string[];
  generated_content: Map<string, StreamingContent>;

  // Error tracking
  error: string | null;
}

/**
 * Initial wizard state
 */
export const initialWizardState: ContentWizardState = {
  current_step: 'select-sources',
  selected_calls: [],
  selected_profile_id: null,
  classification_status: 'idle',
  insights_status: 'idle',
  hooks_status: 'idle',
  content_status: 'idle',
  classification_result: null,
  generated_insights: [],
  generated_hooks: [],
  selected_hook_ids: [],
  generated_content: new Map(),
  error: null,
};

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Business profile context for agent prompts
 * Maps profile fields to agent-expected format
 */
export interface BusinessProfileContext {
  avatar: string; // from icp_customer_segments
  target_audience: string; // from icp_customer_segments
  offer_name: string; // from primary_product_service
  offer_promise: string; // from value_prop_differentiators
  price_point: string; // from average_order_value
  brand_voice: string; // from brand_voice
  prohibited_terms: string; // from prohibited_terms
}

/**
 * Map BusinessProfile to context for agents
 */
export function mapProfileToContext(profile: BusinessProfile): BusinessProfileContext {
  return {
    avatar: profile.icp_customer_segments || '',
    target_audience: profile.icp_customer_segments || '',
    offer_name: profile.primary_product_service || '',
    offer_promise: profile.value_prop_differentiators || '',
    price_point: profile.average_order_value ? `$${profile.average_order_value}` : '',
    brand_voice: profile.brand_voice || '',
    prohibited_terms: profile.prohibited_terms || '',
  };
}

/**
 * Calculate completion percentage for a business profile
 */
export function calculateProfileCompletion(profile: BusinessProfile): number {
  const fields = [
    profile.company_name,
    profile.website,
    profile.primary_product_service,
    profile.industry,
    profile.product_service_delivery,
    profile.employees_count,
    profile.primary_delivery_method,
    profile.business_model,
    profile.primary_selling_mechanism,
    profile.current_tech_status,
    profile.primary_advertising_mode,
    profile.primary_lead_getter,
    profile.primary_marketing_channel,
    profile.marketing_channels,
    profile.messaging_angles,
    profile.sales_cycle_length,
    profile.primary_social_platforms,
    profile.customer_acquisition_process,
    profile.customer_onboarding_process,
    profile.icp_customer_segments,
    profile.primary_pain_points,
    profile.top_objections,
    profile.top_decision_drivers,
    profile.value_prop_differentiators,
    profile.proof_assets_social_proof,
    profile.average_order_value,
    profile.customer_average_order_value,
    profile.customer_lifetime_value,
    profile.guarantees,
    profile.promotions_offers,
    profile.other_products,
    profile.brand_voice,
    profile.prohibited_terms,
    profile.common_sayings_trust_signals,
    profile.biggest_growth_constraint,
  ];

  const filledFields = fields.filter(
    (field) => field !== null && field !== undefined && field !== ''
  ).length;

  return Math.round((filledFields / fields.length) * 100);
}

-- Migration: Create business_profiles table for storing user business context
-- Purpose: Enable users to create and manage business profiles that ground AI content generation
-- Author: Claude Code
-- Date: 2026-01-11

-- ============================================================================
-- TABLE: business_profiles
-- ============================================================================
-- Stores business profile data with 34 fields for AI content personalization
-- Users can have up to 3 profiles, with one marked as default
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT FALSE,

  -- Company & Product (5 fields)
  company_name TEXT,
  website TEXT,
  primary_product_service TEXT,
  industry TEXT,
  product_service_delivery TEXT CHECK (product_service_delivery IS NULL OR product_service_delivery IN ('Software', 'Info services', 'Physical products')),

  -- Business Model & Operations (5 fields)
  employees_count INTEGER,
  primary_delivery_method TEXT CHECK (primary_delivery_method IS NULL OR primary_delivery_method IN ('DIY', 'Done with you', 'Done for you')),
  business_model TEXT CHECK (business_model IS NULL OR business_model IN ('Low-volume high-ticket', 'High-volume low-ticket', 'One-time')),
  primary_selling_mechanism TEXT CHECK (primary_selling_mechanism IS NULL OR primary_selling_mechanism IN ('In-person self-checkout', 'In-person salesperson', 'Online self-checkout', 'Online salesperson')),
  current_tech_status TEXT,

  -- Marketing & Sales (7 fields)
  primary_advertising_mode TEXT CHECK (primary_advertising_mode IS NULL OR primary_advertising_mode IN ('Warm outreach', 'Cold outreach', 'Free content', 'Paid ads')),
  primary_lead_getter TEXT CHECK (primary_lead_getter IS NULL OR primary_lead_getter IN ('Themselves or employees', 'Referrals', 'Agencies', 'Affiliates')),
  primary_marketing_channel TEXT,
  marketing_channels TEXT,
  messaging_angles TEXT,
  sales_cycle_length INTEGER,
  primary_social_platforms TEXT,

  -- Customer Acquisition & Onboarding (2 fields)
  customer_acquisition_process TEXT,
  customer_onboarding_process TEXT,

  -- Customer Insights (4 fields)
  icp_customer_segments TEXT,
  primary_pain_points TEXT,
  top_objections TEXT,
  top_decision_drivers TEXT,

  -- Value Proposition (2 fields)
  value_prop_differentiators TEXT,
  proof_assets_social_proof TEXT,

  -- Offers & Products (6 fields)
  average_order_value NUMERIC,
  customer_average_order_value NUMERIC,
  customer_lifetime_value NUMERIC,
  guarantees TEXT,
  promotions_offers TEXT,
  other_products TEXT,

  -- Brand & Voice (3 fields)
  brand_voice TEXT,
  prohibited_terms TEXT,
  common_sayings_trust_signals TEXT,

  -- Growth (1 field)
  biggest_growth_constraint TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT business_profiles_company_name_length CHECK (company_name IS NULL OR char_length(company_name) <= 255),
  CONSTRAINT business_profiles_website_length CHECK (website IS NULL OR char_length(website) <= 500),
  CONSTRAINT business_profiles_employees_positive CHECK (employees_count IS NULL OR employees_count >= 0),
  CONSTRAINT business_profiles_sales_cycle_positive CHECK (sales_cycle_length IS NULL OR sales_cycle_length >= 0)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Performance indexes for common query patterns

-- Index for looking up profiles by user
CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id
  ON public.business_profiles(user_id);

-- Index for finding default profiles quickly
CREATE INDEX IF NOT EXISTS idx_business_profiles_is_default
  ON public.business_profiles(user_id, is_default) WHERE is_default = TRUE;

-- Index for sorting by creation date (most recent first)
CREATE INDEX IF NOT EXISTS idx_business_profiles_created_at
  ON public.business_profiles(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Automatically update the updated_at timestamp

-- Reuse existing update_updated_at_column function if it exists, otherwise create it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to business_profiles table
DROP TRIGGER IF EXISTS update_business_profiles_updated_at ON public.business_profiles;
CREATE TRIGGER update_business_profiles_updated_at
  BEFORE UPDATE ON public.business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTION: Enforce max 3 profiles per user
-- ============================================================================
CREATE OR REPLACE FUNCTION enforce_max_business_profiles()
RETURNS TRIGGER AS $$
DECLARE
  profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count
  FROM public.business_profiles
  WHERE user_id = NEW.user_id;

  IF profile_count >= 3 THEN
    RAISE EXCEPTION 'Users can have a maximum of 3 business profiles';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to enforce limit on insert
DROP TRIGGER IF EXISTS enforce_max_business_profiles_trigger ON public.business_profiles;
CREATE TRIGGER enforce_max_business_profiles_trigger
  BEFORE INSERT ON public.business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_max_business_profiles();

-- ============================================================================
-- FUNCTION: Ensure only one default profile per user
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_single_default_business_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this profile as default, unset any other defaults for this user
  IF NEW.is_default = TRUE THEN
    UPDATE public.business_profiles
    SET is_default = FALSE
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to ensure single default
DROP TRIGGER IF EXISTS ensure_single_default_business_profile_trigger ON public.business_profiles;
CREATE TRIGGER ensure_single_default_business_profile_trigger
  BEFORE INSERT OR UPDATE ON public.business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_business_profile();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS on business_profiles table
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: business_profiles
-- ============================================================================

-- Policy: Users can view their own business profiles
CREATE POLICY "Users can view their own business profiles"
  ON public.business_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own business profiles
CREATE POLICY "Users can insert their own business profiles"
  ON public.business_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own business profiles
CREATE POLICY "Users can update their own business profiles"
  ON public.business_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own business profiles
CREATE POLICY "Users can delete their own business profiles"
  ON public.business_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
-- Grant permissions to authenticated users
GRANT ALL ON public.business_profiles TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Add helpful comments to table and columns

COMMENT ON TABLE public.business_profiles IS
  'Stores business profile data with 34 fields for AI content personalization. Users can have up to 3 profiles with one default.';

COMMENT ON COLUMN public.business_profiles.user_id IS
  'User who owns this business profile';

COMMENT ON COLUMN public.business_profiles.is_default IS
  'Whether this is the default profile for content generation. Only one profile per user can be default.';

-- Company & Product
COMMENT ON COLUMN public.business_profiles.company_name IS
  'Name of the company or business';

COMMENT ON COLUMN public.business_profiles.website IS
  'Company website URL';

COMMENT ON COLUMN public.business_profiles.primary_product_service IS
  'Primary product or service offered';

COMMENT ON COLUMN public.business_profiles.industry IS
  'Industry the business operates in';

COMMENT ON COLUMN public.business_profiles.product_service_delivery IS
  'How the product/service is delivered: Software, Info services, or Physical products';

-- Business Model & Operations
COMMENT ON COLUMN public.business_profiles.employees_count IS
  'Number of employees in the company';

COMMENT ON COLUMN public.business_profiles.primary_delivery_method IS
  'Primary delivery method: DIY, Done with you, or Done for you';

COMMENT ON COLUMN public.business_profiles.business_model IS
  'Business model: Low-volume high-ticket, High-volume low-ticket, or One-time';

COMMENT ON COLUMN public.business_profiles.primary_selling_mechanism IS
  'Primary selling mechanism: In-person/Online self-checkout or salesperson';

COMMENT ON COLUMN public.business_profiles.current_tech_status IS
  'Current technology status and tools used';

-- Marketing & Sales
COMMENT ON COLUMN public.business_profiles.primary_advertising_mode IS
  'Primary advertising mode: Warm outreach, Cold outreach, Free content, or Paid ads';

COMMENT ON COLUMN public.business_profiles.primary_lead_getter IS
  'Primary lead source: Themselves/employees, Referrals, Agencies, or Affiliates';

COMMENT ON COLUMN public.business_profiles.primary_marketing_channel IS
  'Primary marketing channel used';

COMMENT ON COLUMN public.business_profiles.marketing_channels IS
  'All marketing channels used';

COMMENT ON COLUMN public.business_profiles.messaging_angles IS
  'Key messaging angles and positioning';

COMMENT ON COLUMN public.business_profiles.sales_cycle_length IS
  'Average sales cycle length in days';

COMMENT ON COLUMN public.business_profiles.primary_social_platforms IS
  'Primary social media platforms used';

-- Customer Acquisition & Onboarding
COMMENT ON COLUMN public.business_profiles.customer_acquisition_process IS
  'Description of customer acquisition process';

COMMENT ON COLUMN public.business_profiles.customer_onboarding_process IS
  'Description of customer onboarding process';

-- Customer Insights
COMMENT ON COLUMN public.business_profiles.icp_customer_segments IS
  'Ideal Customer Profile - customer segments or buyer personas';

COMMENT ON COLUMN public.business_profiles.primary_pain_points IS
  'Primary pain points of target customers';

COMMENT ON COLUMN public.business_profiles.top_objections IS
  'Top objections encountered in sales';

COMMENT ON COLUMN public.business_profiles.top_decision_drivers IS
  'Top factors that drive purchase decisions';

-- Value Proposition
COMMENT ON COLUMN public.business_profiles.value_prop_differentiators IS
  'Key value proposition differentiators';

COMMENT ON COLUMN public.business_profiles.proof_assets_social_proof IS
  'Proof assets and social proof available';

-- Offers & Products
COMMENT ON COLUMN public.business_profiles.average_order_value IS
  'Average order value in dollars';

COMMENT ON COLUMN public.business_profiles.customer_average_order_value IS
  'Customer average order value in dollars';

COMMENT ON COLUMN public.business_profiles.customer_lifetime_value IS
  'Customer lifetime value in dollars';

COMMENT ON COLUMN public.business_profiles.guarantees IS
  'Any guarantees offered';

COMMENT ON COLUMN public.business_profiles.promotions_offers IS
  'Current promotions, offers, or offer packages';

COMMENT ON COLUMN public.business_profiles.other_products IS
  'Other products offered (high-ticket, mid-ticket, low-ticket)';

-- Brand & Voice
COMMENT ON COLUMN public.business_profiles.brand_voice IS
  'Description of brand voice and tone';

COMMENT ON COLUMN public.business_profiles.prohibited_terms IS
  'Terms or phrases that should not be used';

COMMENT ON COLUMN public.business_profiles.common_sayings_trust_signals IS
  'Common sayings or trust signals used in communication';

-- Growth
COMMENT ON COLUMN public.business_profiles.biggest_growth_constraint IS
  'Biggest constraint to business growth';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Migration: Drop feature_flags table
-- Purpose: FLAG-01 — the feature-flag system is removed entirely. All frontend
--          readers (useFeatureFlags hook, Layout/sidebar-nav gates, AdminTab
--          flag toggles) were deleted first; every previously gated surface is
--          now hard-enabled. Policies and seed rows drop with the table.
-- Date: 2026-06-11

DROP TABLE IF EXISTS public.feature_flags;

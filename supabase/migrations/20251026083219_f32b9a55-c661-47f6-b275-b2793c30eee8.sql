-- Simplify call_categories table - remove auto categorization features
ALTER TABLE public.call_categories 
  DROP COLUMN IF EXISTS filter_rules,
  DROP COLUMN IF EXISTS auto_categorize;

-- Remove description column if you don't need it, or keep it for future use
-- ALTER TABLE public.call_categories DROP COLUMN IF EXISTS description;
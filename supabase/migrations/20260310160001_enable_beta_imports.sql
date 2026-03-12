-- Enable beta_imports for all users at launch
-- The feature_flags table uses: id (text PK), name (text), description (text),
-- is_enabled (boolean), enabled_for_roles (text[]), updated_at (timestamptz)
INSERT INTO public.feature_flags (id, name, description, is_enabled, enabled_for_roles)
VALUES (
  'beta_imports',
  'Import Hub',
  'Import and Routing features — enabled for all users at launch',
  true,
  ARRAY['FREE', 'PRO', 'TEAM', 'ADMIN']
)
ON CONFLICT (id) DO UPDATE SET
  is_enabled = true,
  enabled_for_roles = ARRAY['FREE', 'PRO', 'TEAM', 'ADMIN'],
  updated_at = now();

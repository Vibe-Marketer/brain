-- Step 1: Assign all orphaned meetings to andrew@aisimple.co
-- COMMENTED OUT: Data will be migrated separately via export/import tools
-- UPDATE fathom_calls
-- SET user_id = 'eaa275cd-c72b-4a08-adb5-2a002fb8f6a3'
-- WHERE user_id IS NULL;

-- Step 2: Make user_id NOT NULL to prevent future orphans
-- COMMENTED OUT: Will be applied after data migration to avoid blocking NULL user_ids in imported data
-- ALTER TABLE fathom_calls
-- ALTER COLUMN user_id SET NOT NULL;

-- Step 3: Add trigger to enforce user_id on insert/update
-- COMMENTED OUT: Will be applied after data migration to avoid blocking NULL user_ids in imported data
-- CREATE OR REPLACE FUNCTION ensure_user_id_on_fathom_calls()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF NEW.user_id IS NULL THEN
--     RAISE EXCEPTION 'user_id cannot be NULL for fathom_calls';
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
--
-- CREATE TRIGGER enforce_user_id_fathom_calls
-- BEFORE INSERT OR UPDATE ON fathom_calls
-- FOR EACH ROW
-- EXECUTE FUNCTION ensure_user_id_on_fathom_calls();

-- Step 4: Create user_profiles table for account management
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Create user_settings table for per-user Fathom configuration
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  fathom_api_key TEXT,
  webhook_secret TEXT,
  host_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 6: Migrate existing app_config to user_settings for andrew@aisimple.co
-- COMMENTED OUT: Data will be migrated separately via export/import tools
-- INSERT INTO user_settings (user_id, fathom_api_key, webhook_secret, host_email)
-- VALUES (
--   'eaa275cd-c72b-4a08-adb5-2a002fb8f6a3',
--   (SELECT value FROM app_config WHERE key = 'FATHOM_API_KEY'),
--   (SELECT value FROM app_config WHERE key = 'WEBHOOK_SECRET'),
--   (SELECT value FROM app_config WHERE key = 'HOST_EMAIL')
-- );

-- Step 7: Create profile for andrew@aisimple.co
-- COMMENTED OUT: Data will be migrated separately via export/import tools
-- INSERT INTO user_profiles (user_id, display_name)
-- VALUES ('eaa275cd-c72b-4a08-adb5-2a002fb8f6a3', 'Andrew');

-- Step 8: Enable RLS on new tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS policies for user_profiles
CREATE POLICY "Users can read own profile"
ON user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Step 10: Create RLS policies for user_settings
CREATE POLICY "Users can read own settings"
ON user_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
ON user_settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
ON user_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Step 11: Service role can manage user_settings (for edge functions)
CREATE POLICY "Service role can manage user_settings"
ON user_settings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 12: Create updated_at trigger for user_profiles
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_speakers_updated_at();

-- Step 13: Create updated_at trigger for user_settings
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION update_speakers_updated_at();
-- Create function to auto-create user profile and default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile for new user
  INSERT INTO public.user_profiles (user_id, display_name, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    false
  );
  
  -- Assign default FREE role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'FREE')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to auto-create profile + role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles for existing users
INSERT INTO public.user_profiles (user_id, display_name, onboarding_completed)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'display_name', au.email),
  false
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id
WHERE up.user_id IS NULL;

-- Backfill missing roles for existing users (set them all to FREE by default)
INSERT INTO public.user_roles (user_id, role)
SELECT 
  au.id,
  'FREE'
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;
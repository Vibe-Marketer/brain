-- Allow admins to view all user profiles (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles' 
    AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'ADMIN'));
  END IF;
END $$;
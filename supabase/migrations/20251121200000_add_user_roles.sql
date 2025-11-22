-- Migration: Add secure user roles system
-- Created: 2025-11-21
-- Purpose: Implement role-based access control with security definer functions to prevent privilege escalation

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('FREE', 'PRO', 'TEAM', 'ADMIN');

-- Create user_roles table (separate from user_profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY
    CASE role
      WHEN 'ADMIN' THEN 1
      WHEN 'TEAM' THEN 2
      WHEN 'PRO' THEN 3
      WHEN 'FREE' THEN 4
    END
  LIMIT 1
$$;

-- RLS Policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'ADMIN'));

-- Set existing user (andrew@aisimple.co) to ADMIN role
-- COMMENTED OUT: Data will be migrated separately via export/import tools
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('eaa275cd-c72b-4a08-adb5-2a002fb8f6a3', 'ADMIN')
-- ON CONFLICT (user_id, role) DO NOTHING;

-- Create index for faster role lookups
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- Add comments for documentation
COMMENT ON TABLE public.user_roles IS 'Stores user roles separately from profiles for security (prevents privilege escalation attacks)';
COMMENT ON COLUMN public.user_roles.role IS 'User role: FREE (default), PRO (premium features), TEAM (multi-user access), ADMIN (full access)';

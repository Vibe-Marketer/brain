-- Add full_transcript and summary columns to fathom_calls
ALTER TABLE public.fathom_calls
ADD COLUMN full_transcript TEXT,
ADD COLUMN summary TEXT;

-- Create call_categories table for organizing calls
CREATE TABLE public.call_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  filter_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  auto_categorize BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create junction table for call-category assignments
CREATE TABLE public.call_category_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_recording_id BIGINT NOT NULL REFERENCES public.fathom_calls(recording_id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.call_categories(id) ON DELETE CASCADE,
  auto_assigned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(call_recording_id, category_id)
);

-- Create indexes for better performance
CREATE INDEX idx_call_categories_auto ON public.call_categories(auto_categorize);
CREATE INDEX idx_category_assignments_call ON public.call_category_assignments(call_recording_id);
CREATE INDEX idx_category_assignments_category ON public.call_category_assignments(category_id);

-- Enable RLS on new tables
ALTER TABLE public.call_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_category_assignments ENABLE ROW LEVEL SECURITY;

-- Add public read access policies
CREATE POLICY "Allow public read access to call_categories"
ON public.call_categories
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public read access to call_category_assignments"
ON public.call_category_assignments
FOR SELECT
TO public
USING (true);

-- Add public write access for categories (for managing folders)
CREATE POLICY "Allow public write access to call_categories"
ON public.call_categories
FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public write access to call_category_assignments"
ON public.call_category_assignments
FOR ALL
TO public
USING (true)
WITH CHECK (true);
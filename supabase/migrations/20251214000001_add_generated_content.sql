-- Add generated_content table for storing AI-generated content
CREATE TABLE IF NOT EXISTS public.generated_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('email', 'social-post', 'blog-outline', 'case-study')),
    content TEXT NOT NULL,
    insight_ids UUID[] NOT NULL,
    context JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_generated_content_type ON public.generated_content(type);
CREATE INDEX IF NOT EXISTS idx_generated_content_user_id ON public.generated_content(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_created_at ON public.generated_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_content_insight_ids ON public.generated_content USING GIN(insight_ids);

-- Enable Row Level Security
ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own generated content"
    ON public.generated_content FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own generated content"
    ON public.generated_content FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own generated content"
    ON public.generated_content FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own generated content"
    ON public.generated_content FOR DELETE
    USING (user_id = auth.uid());

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_generated_content_updated_at ON public.generated_content;
CREATE TRIGGER update_generated_content_updated_at
    BEFORE UPDATE ON public.generated_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.generated_content TO authenticated;

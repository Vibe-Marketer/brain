-- Add insights table for AI-extracted insights
CREATE TABLE IF NOT EXISTS public.insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recording_id BIGINT NOT NULL,
    user_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('pain', 'success', 'objection', 'question')),
    content TEXT NOT NULL,
    confidence NUMERIC(5,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    context TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (recording_id, user_id) REFERENCES public.fathom_calls(recording_id, user_id) ON DELETE CASCADE
);

-- Add quotes table for notable quotes
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recording_id BIGINT NOT NULL,
    user_id UUID NOT NULL,
    text TEXT NOT NULL,
    speaker TEXT,
    timestamp TEXT,
    significance NUMERIC(5,2) CHECK (significance >= 0 AND significance <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (recording_id, user_id) REFERENCES public.fathom_calls(recording_id, user_id) ON DELETE CASCADE
);

-- Add workspaces table for organizing calls
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '📁',
    description TEXT,
    gradient TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add workspace_members table for collaboration
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- Add workspace_calls junction table
CREATE TABLE IF NOT EXISTS public.workspace_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    recording_id BIGINT NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (recording_id, user_id) REFERENCES public.fathom_calls(recording_id, user_id) ON DELETE CASCADE,
    UNIQUE(workspace_id, recording_id, user_id)
);

-- Add AI processing columns to calls table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fathom_calls' AND column_name = 'summary') THEN
        ALTER TABLE public.fathom_calls ADD COLUMN summary TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fathom_calls' AND column_name = 'sentiment') THEN
        ALTER TABLE public.fathom_calls ADD COLUMN sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fathom_calls' AND column_name = 'sentiment_score') THEN
        ALTER TABLE public.fathom_calls ADD COLUMN sentiment_score NUMERIC(5,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fathom_calls' AND column_name = 'key_topics') THEN
        ALTER TABLE public.fathom_calls ADD COLUMN key_topics TEXT[] DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fathom_calls' AND column_name = 'action_items') THEN
        ALTER TABLE public.fathom_calls ADD COLUMN action_items TEXT[] DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fathom_calls' AND column_name = 'profits_framework') THEN
        ALTER TABLE public.fathom_calls ADD COLUMN profits_framework JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fathom_calls' AND column_name = 'ai_processed') THEN
        ALTER TABLE public.fathom_calls ADD COLUMN ai_processed BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fathom_calls' AND column_name = 'ai_processed_at') THEN
        ALTER TABLE public.fathom_calls ADD COLUMN ai_processed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_insights_recording_user ON public.insights(recording_id, user_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON public.insights(type);
CREATE INDEX IF NOT EXISTS idx_insights_confidence ON public.insights(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_insights_created_at ON public.insights(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotes_recording_user ON public.quotes(recording_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_significance ON public.quotes(significance DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON public.quotes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON public.workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_at ON public.workspaces(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_calls_workspace_id ON public.workspace_calls(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_calls_recording_user ON public.workspace_calls(recording_id, user_id);

CREATE INDEX IF NOT EXISTS idx_calls_ai_processed ON public.fathom_calls(ai_processed);
CREATE INDEX IF NOT EXISTS idx_calls_sentiment ON public.fathom_calls(sentiment);

-- Enable Row Level Security
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies for insights
CREATE POLICY "Users can view insights from their calls"
    ON public.insights FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert insights for their calls"
    ON public.insights FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- RLS Policies for quotes
CREATE POLICY "Users can view quotes from their calls"
    ON public.quotes FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert quotes for their calls"
    ON public.quotes FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- RLS Policies for workspaces
CREATE POLICY "Users can view their own workspaces"
    ON public.workspaces FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own workspaces"
    ON public.workspaces FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own workspaces"
    ON public.workspaces FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own workspaces"
    ON public.workspaces FOR DELETE
    USING (user_id = auth.uid());

-- RLS Policies for workspace_members
CREATE POLICY "Users can view workspace members if they are a member"
    ON public.workspace_members FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace owners can manage members"
    ON public.workspace_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- RLS Policies for workspace_calls
CREATE POLICY "Workspace members can view workspace calls"
    ON public.workspace_calls FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_calls.workspace_id
            AND wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can add calls to workspace"
    ON public.workspace_calls FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_calls.workspace_id
            AND wm.user_id = auth.uid()
        )
        AND workspace_calls.user_id = auth.uid()
    );

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_insights_updated_at ON public.insights;
CREATE TRIGGER update_insights_updated_at
    BEFORE UPDATE ON public.insights
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotes_updated_at ON public.quotes;
CREATE TRIGGER update_quotes_updated_at
    BEFORE UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.insights TO authenticated;
GRANT ALL ON public.quotes TO authenticated;
GRANT ALL ON public.workspaces TO authenticated;
GRANT ALL ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_calls TO authenticated;

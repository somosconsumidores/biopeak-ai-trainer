-- Fix RLS policies for strava_tokens and strava_activities tables
-- The current policies are too restrictive and causing fallback to SERVICE_ROLE_KEY

-- Drop existing problematic policies for strava_tokens
DROP POLICY IF EXISTS "Enable upsert for authenticated users" ON public.strava_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.strava_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.strava_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON public.strava_tokens;
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.strava_tokens;

-- Create new, more permissive policies for strava_tokens
CREATE POLICY "Users can manage their own strava tokens" 
ON public.strava_tokens 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Drop existing problematic policies for strava_activities  
DROP POLICY IF EXISTS "Users can insert their own activities" ON public.strava_activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.strava_activities;
DROP POLICY IF EXISTS "Users can view their own activities" ON public.strava_activities;

-- Create new, more permissive policies for strava_activities
CREATE POLICY "Users can manage their own strava activities" 
ON public.strava_activities 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add index for better performance on common queries
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_date 
ON public.strava_activities (user_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_strava_activities_sync_check 
ON public.strava_activities (user_id, strava_activity_id);

-- Add a table to track sync status and enable incremental sync
CREATE TABLE IF NOT EXISTS public.strava_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity_date TIMESTAMP WITH TIME ZONE,
  total_activities_synced INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sync status table
ALTER TABLE public.strava_sync_status ENABLE ROW LEVEL SECURITY;

-- Create policy for sync status
CREATE POLICY "Users can manage their own sync status" 
ON public.strava_sync_status 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add unique constraint to prevent duplicate sync status per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_strava_sync_status_user 
ON public.strava_sync_status (user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_strava_sync_status_updated_at
BEFORE UPDATE ON public.strava_sync_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Fix RLS policy for strava_tokens table
-- The current policy might be too restrictive for edge functions

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can manage their own tokens" ON public.strava_tokens;

-- Create separate policies for different operations
CREATE POLICY "Users can view their own tokens" 
ON public.strava_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens" 
ON public.strava_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens" 
ON public.strava_tokens 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens" 
ON public.strava_tokens 
FOR DELETE 
USING (auth.uid() = user_id);
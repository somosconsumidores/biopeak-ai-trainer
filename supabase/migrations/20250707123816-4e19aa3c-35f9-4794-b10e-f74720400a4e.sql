-- Fix RLS policies for strava_tokens to work with edge functions
-- The issue is that edge functions need proper authentication context

-- First, drop existing policies
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.strava_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.strava_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON public.strava_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.strava_tokens;

-- Create new policies that work with edge functions
-- The edge function passes the user JWT token, so auth.uid() should work
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

-- Also create a policy for upsert operations (combination of INSERT and UPDATE)
-- This is important for the edge function that does upsert
CREATE POLICY "Enable upsert for authenticated users" 
ON public.strava_tokens 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
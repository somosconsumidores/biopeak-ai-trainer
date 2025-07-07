-- Fix RLS policy for strava_tokens table
-- The edge function needs to authenticate properly with the user's JWT token

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can manage their own tokens" ON strava_tokens;

-- Create a more specific policy for user authentication
CREATE POLICY "Users can view their own tokens" 
ON strava_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens" 
ON strava_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens" 
ON strava_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens" 
ON strava_tokens 
FOR DELETE 
USING (auth.uid() = user_id);
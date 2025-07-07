-- Remove the existing unique constraint on strava_activity_id alone
ALTER TABLE public.strava_activities DROP CONSTRAINT IF EXISTS strava_activities_strava_activity_id_key;

-- Add a composite unique constraint on (user_id, strava_activity_id)
-- This ensures each user can have their own activities, even if by some chance 
-- there were duplicate Strava activity IDs (which shouldn't happen in practice)
ALTER TABLE public.strava_activities 
ADD CONSTRAINT strava_activities_user_strava_unique 
UNIQUE (user_id, strava_activity_id);

-- Add an index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_id 
ON public.strava_activities (user_id);

-- Add an index on start_date for better sorting performance
CREATE INDEX IF NOT EXISTS idx_strava_activities_start_date 
ON public.strava_activities (start_date DESC);
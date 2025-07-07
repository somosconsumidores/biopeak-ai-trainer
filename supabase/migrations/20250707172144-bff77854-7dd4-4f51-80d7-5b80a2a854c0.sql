-- Step 1: Remove the existing foreign key constraint
ALTER TABLE public.training_sessions 
DROP CONSTRAINT IF EXISTS training_sessions_strava_activity_id_fkey;

-- Step 2: Remove the existing unique constraint on strava_activity_id alone
ALTER TABLE public.strava_activities 
DROP CONSTRAINT IF EXISTS strava_activities_strava_activity_id_key;

-- Step 3: Add a composite unique constraint on (user_id, strava_activity_id)
-- This ensures each user can have their own activities
ALTER TABLE public.strava_activities 
ADD CONSTRAINT strava_activities_user_strava_unique 
UNIQUE (user_id, strava_activity_id);

-- Step 4: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_id 
ON public.strava_activities (user_id);

CREATE INDEX IF NOT EXISTS idx_strava_activities_start_date 
ON public.strava_activities (start_date DESC);

-- Step 5: Recreate foreign key constraint with proper referencing
-- Since training_sessions also has user_id, we should ensure data integrity
-- by adding a constraint that checks both user_id and strava_activity_id match
ALTER TABLE public.training_sessions
ADD CONSTRAINT training_sessions_strava_activity_fkey 
FOREIGN KEY (user_id, strava_activity_id) 
REFERENCES public.strava_activities(user_id, strava_activity_id);
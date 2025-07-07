-- Add unique constraint to garmin_activities if it doesn't exist
DO $$ 
BEGIN
    -- Check if the unique constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'garmin_activities_user_id_garmin_activity_id_key'
    ) THEN
        -- Add the unique constraint
        ALTER TABLE public.garmin_activities 
        ADD CONSTRAINT garmin_activities_user_id_garmin_activity_id_key 
        UNIQUE (user_id, garmin_activity_id);
        
        RAISE NOTICE 'Added unique constraint on user_id, garmin_activity_id';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;
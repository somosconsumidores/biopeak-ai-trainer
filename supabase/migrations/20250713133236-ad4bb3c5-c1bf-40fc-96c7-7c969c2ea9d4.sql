-- Allow vo2_max_value to be nullable so we can store fitness_age only records
ALTER TABLE public.garmin_vo2_max 
ALTER COLUMN vo2_max_value DROP NOT NULL;
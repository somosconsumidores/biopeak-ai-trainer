-- Add environmental and location fields to garmin_activities table
ALTER TABLE public.garmin_activities 
ADD COLUMN avg_temperature numeric,
ADD COLUMN max_temperature numeric,
ADD COLUMN weather_condition text,
ADD COLUMN start_latitude numeric,
ADD COLUMN start_longitude numeric,
ADD COLUMN end_latitude numeric,
ADD COLUMN end_longitude numeric;
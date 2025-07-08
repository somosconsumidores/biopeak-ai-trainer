
-- Create table for Garmin daily health stats
CREATE TABLE public.garmin_daily_health (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  summary_date DATE NOT NULL,
  steps INTEGER,
  distance_in_meters NUMERIC,
  active_time_in_seconds INTEGER,
  calories_burned NUMERIC,
  floors_climbed INTEGER,
  sleep_duration_in_seconds INTEGER,
  deep_sleep_duration_in_seconds INTEGER,
  light_sleep_duration_in_seconds INTEGER,
  rem_sleep_duration_in_seconds INTEGER,
  awake_duration_in_seconds INTEGER,
  resting_heart_rate INTEGER,
  stress_score INTEGER,
  body_battery_drained INTEGER,
  body_battery_charged INTEGER,
  moderate_intensity_minutes INTEGER,
  vigorous_intensity_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, summary_date)
);

-- Enable Row Level Security
ALTER TABLE public.garmin_daily_health ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own daily health data" 
ON public.garmin_daily_health 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily health data" 
ON public.garmin_daily_health 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily health data" 
ON public.garmin_daily_health 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create table for detailed activity data
CREATE TABLE public.garmin_activity_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  garmin_activity_id BIGINT NOT NULL,
  activity_summary JSONB,
  heart_rate_zones JSONB,
  time_in_zones JSONB,
  splits_data JSONB,
  location_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, garmin_activity_id)
);

-- Enable Row Level Security for activity details
ALTER TABLE public.garmin_activity_details ENABLE ROW LEVEL SECURITY;

-- Create policies for activity details
CREATE POLICY "Users can view their own activity details" 
ON public.garmin_activity_details 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity details" 
ON public.garmin_activity_details 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity details" 
ON public.garmin_activity_details 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add trigger for updating timestamps
CREATE TRIGGER update_garmin_daily_health_updated_at
BEFORE UPDATE ON public.garmin_daily_health
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_garmin_activity_details_updated_at
BEFORE UPDATE ON public.garmin_activity_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_garmin_daily_health_user_date ON public.garmin_daily_health(user_id, summary_date);
CREATE INDEX idx_garmin_activity_details_user_activity ON public.garmin_activity_details(user_id, garmin_activity_id);

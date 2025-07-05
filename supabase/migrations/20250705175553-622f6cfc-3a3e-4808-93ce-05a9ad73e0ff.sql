-- Create table for Strava activities
CREATE TABLE public.strava_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strava_activity_id BIGINT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  distance NUMERIC,
  moving_time INTEGER,
  elapsed_time INTEGER,
  total_elevation_gain NUMERIC,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  average_speed NUMERIC,
  max_speed NUMERIC,
  average_heartrate INTEGER,
  max_heartrate INTEGER,
  calories NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own activities" 
ON public.strava_activities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activities" 
ON public.strava_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities" 
ON public.strava_activities 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create table for Strava tokens
CREATE TABLE public.strava_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strava_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for tokens
CREATE POLICY "Users can manage their own tokens" 
ON public.strava_tokens 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for timestamp updates
CREATE TRIGGER update_strava_activities_updated_at
BEFORE UPDATE ON public.strava_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strava_tokens_updated_at
BEFORE UPDATE ON public.strava_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create tables for Garmin Connect integration
CREATE TABLE public.garmin_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.garmin_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for garmin_tokens
CREATE POLICY "Users can view their own tokens" 
ON public.garmin_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens" 
ON public.garmin_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens" 
ON public.garmin_tokens 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens" 
ON public.garmin_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Enable upsert for authenticated users"
ON public.garmin_tokens 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create table for Garmin activities
CREATE TABLE public.garmin_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  garmin_activity_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  distance NUMERIC,
  moving_time INTEGER,
  elapsed_time INTEGER,
  total_elevation_gain NUMERIC,
  average_speed NUMERIC,
  max_speed NUMERIC,
  average_heartrate INTEGER,
  max_heartrate INTEGER,
  calories NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, garmin_activity_id)
);

-- Enable Row Level Security
ALTER TABLE public.garmin_activities ENABLE ROW LEVEL SECURITY;

-- Create policies for garmin_activities
CREATE POLICY "Users can view their own activities" 
ON public.garmin_activities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activities" 
ON public.garmin_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities" 
ON public.garmin_activities 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_garmin_tokens_updated_at
BEFORE UPDATE ON public.garmin_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_garmin_activities_updated_at
BEFORE UPDATE ON public.garmin_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
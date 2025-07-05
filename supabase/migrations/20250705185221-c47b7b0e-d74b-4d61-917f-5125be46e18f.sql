-- Create training_sessions table to store processed training data
CREATE TABLE public.training_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strava_activity_id BIGINT REFERENCES public.strava_activities(strava_activity_id),
  name TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL, -- in seconds
  distance NUMERIC, -- in meters
  average_pace NUMERIC, -- in seconds per km
  average_speed NUMERIC, -- in m/s
  average_heartrate INTEGER,
  max_heartrate INTEGER,
  calories NUMERIC,
  elevation_gain NUMERIC,
  performance_score NUMERIC, -- calculated performance score (0-100)
  zones_data JSONB, -- heart rate zones breakdown
  splits_data JSONB, -- pace splits by km
  recovery_metrics JSONB, -- recovery related data
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own training sessions" 
ON public.training_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own training sessions" 
ON public.training_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own training sessions" 
ON public.training_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own training sessions" 
ON public.training_sessions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_training_sessions_updated_at
BEFORE UPDATE ON public.training_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_training_sessions_user_id ON public.training_sessions(user_id);
CREATE INDEX idx_training_sessions_start_date ON public.training_sessions(start_date DESC);
CREATE INDEX idx_training_sessions_strava_activity ON public.training_sessions(strava_activity_id);
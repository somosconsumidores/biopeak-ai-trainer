-- Create table for Strava activity streams (heart rate time-series data)
CREATE TABLE public.strava_activity_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strava_activity_id BIGINT NOT NULL,
  stream_type TEXT NOT NULL,
  stream_data JSONB NOT NULL,
  original_size INTEGER,
  resolution TEXT,
  series_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_strava_activity_streams_activity 
    FOREIGN KEY (user_id, strava_activity_id) 
    REFERENCES public.strava_activities(user_id, strava_activity_id)
    ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.strava_activity_streams ENABLE ROW LEVEL SECURITY;

-- Create policies for streams
CREATE POLICY "Users can view their own activity streams" 
ON public.strava_activity_streams 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity streams" 
ON public.strava_activity_streams 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity streams" 
ON public.strava_activity_streams 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for timestamp updates
CREATE TRIGGER update_strava_activity_streams_updated_at
BEFORE UPDATE ON public.strava_activity_streams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_strava_activity_streams_user_activity 
ON public.strava_activity_streams(user_id, strava_activity_id);

CREATE INDEX idx_strava_activity_streams_type 
ON public.strava_activity_streams(stream_type);
-- Create garmin_backfill_status table for tracking backfill operations
CREATE TABLE public.garmin_backfill_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'error')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  activities_processed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.garmin_backfill_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own backfill status" 
ON public.garmin_backfill_status 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own backfill status" 
ON public.garmin_backfill_status 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own backfill status" 
ON public.garmin_backfill_status 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_garmin_backfill_user_id ON public.garmin_backfill_status(user_id);
CREATE INDEX idx_garmin_backfill_status ON public.garmin_backfill_status(status);
CREATE INDEX idx_garmin_backfill_period ON public.garmin_backfill_status(user_id, period_start, period_end);

-- Create unique constraint to prevent duplicate backfill requests for same period
CREATE UNIQUE INDEX idx_garmin_backfill_unique_period ON public.garmin_backfill_status(user_id, period_start, period_end);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_garmin_backfill_status_updated_at
BEFORE UPDATE ON public.garmin_backfill_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint to garmin_activities to prevent duplicates
ALTER TABLE public.garmin_activities 
ADD CONSTRAINT unique_garmin_activity_per_user 
UNIQUE (user_id, garmin_activity_id);
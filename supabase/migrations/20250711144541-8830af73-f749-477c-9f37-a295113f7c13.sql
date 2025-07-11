-- Create table for VO2 Max data
CREATE TABLE public.garmin_vo2_max (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vo2_max_value NUMERIC NOT NULL,
  measurement_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, measurement_date)
);

-- Enable Row Level Security
ALTER TABLE public.garmin_vo2_max ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own vo2max data" 
ON public.garmin_vo2_max 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vo2max data" 
ON public.garmin_vo2_max 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vo2max data" 
ON public.garmin_vo2_max 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_garmin_vo2_max_updated_at
BEFORE UPDATE ON public.garmin_vo2_max
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
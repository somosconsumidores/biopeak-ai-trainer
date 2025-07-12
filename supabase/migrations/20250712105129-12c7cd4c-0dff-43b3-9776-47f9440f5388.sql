-- Add fitness_age column to garmin_vo2_max table
ALTER TABLE public.garmin_vo2_max 
ADD COLUMN fitness_age integer;

-- Update the updated_at trigger to include the new column
DROP TRIGGER IF EXISTS update_garmin_vo2_max_updated_at ON public.garmin_vo2_max;
CREATE TRIGGER update_garmin_vo2_max_updated_at
BEFORE UPDATE ON public.garmin_vo2_max
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
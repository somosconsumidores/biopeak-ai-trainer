-- Extend garmin_backfill_status table to support the new backfill API structure
ALTER TABLE public.garmin_backfill_status 
ADD COLUMN summary_type TEXT NOT NULL DEFAULT 'dailies',
ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3,
ADD COLUMN next_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN rate_limit_reset_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN is_duplicate BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for efficient querying by summary type and status
CREATE INDEX idx_garmin_backfill_summary_type_status ON public.garmin_backfill_status(user_id, summary_type, status);

-- Add index for retry logic
CREATE INDEX idx_garmin_backfill_retry ON public.garmin_backfill_status(status, next_retry_at) WHERE next_retry_at IS NOT NULL;

-- Update existing records to have summary_type 'dailies' (most common health data)
UPDATE public.garmin_backfill_status SET summary_type = 'dailies' WHERE summary_type IS NULL;

-- Add constraint to ensure valid summary types
ALTER TABLE public.garmin_backfill_status 
ADD CONSTRAINT check_summary_type 
CHECK (summary_type IN ('dailies', 'epochs', 'sleeps', 'bodyComps', 'stressDetails', 'userMetrics', 'pulseOx', 'respiration', 'healthSnapshot', 'hrv', 'bloodPressures', 'skinTemp'));

-- Create function to handle backfill retry logic
CREATE OR REPLACE FUNCTION public.calculate_next_retry(retry_count INTEGER, base_delay_minutes INTEGER DEFAULT 5)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
AS $$
BEGIN
  -- Exponential backoff: 5min, 10min, 20min, 40min, etc.
  RETURN NOW() + (base_delay_minutes * POWER(2, retry_count)) * INTERVAL '1 minute';
END;
$$;
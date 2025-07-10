-- Enable cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule backfill cleanup to run every hour
SELECT cron.schedule(
  'garmin-backfill-cleanup',
  '0 * * * *', -- every hour at minute 0
  $$
  select
    net.http_post(
        url:='https://qytorkjmzxscyaefkhnk.supabase.co/functions/v1/garmin-backfill-cleanup',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Create a table to track webhook call statistics
CREATE TABLE IF NOT EXISTS public.webhook_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_type TEXT NOT NULL,
  user_id UUID,
  call_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT true,
  activities_processed INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on webhook_stats
ALTER TABLE public.webhook_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for webhook_stats
CREATE POLICY "Users can view their own webhook stats" 
ON public.webhook_stats 
FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "System can insert webhook stats" 
ON public.webhook_stats 
FOR INSERT 
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_webhook_stats_user_timestamp 
ON public.webhook_stats(user_id, call_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_stats_type_timestamp 
ON public.webhook_stats(webhook_type, call_timestamp DESC);

-- Create a function to clean up old webhook stats (keep only last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_stats()
RETURNS void AS $$
BEGIN
  DELETE FROM public.webhook_stats 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup of old webhook stats to run daily
SELECT cron.schedule(
  'webhook-stats-cleanup',
  '0 2 * * *', -- daily at 2 AM
  'SELECT cleanup_old_webhook_stats();'
);
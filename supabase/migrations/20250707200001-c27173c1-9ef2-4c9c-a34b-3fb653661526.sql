-- Fix Garmin tokens table structure for proper OAuth 1.0
-- Change refresh_token to token_secret and add proper OAuth 1.0 fields
ALTER TABLE public.garmin_tokens 
RENAME COLUMN refresh_token TO token_secret;

-- Add OAuth 1.0 specific fields
ALTER TABLE public.garmin_tokens 
ADD COLUMN IF NOT EXISTS consumer_key TEXT,
ADD COLUMN IF NOT EXISTS oauth_verifier TEXT;

-- Update the table comment
COMMENT ON TABLE public.garmin_tokens IS 'Stores OAuth 1.0 tokens for Garmin Connect integration';

-- Create table for webhook configurations
CREATE TABLE IF NOT EXISTS public.garmin_webhook_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  summary_type TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on webhook config table
ALTER TABLE public.garmin_webhook_config ENABLE ROW LEVEL SECURITY;

-- Create policies for webhook config
CREATE POLICY "Users can view their own webhook config" 
ON public.garmin_webhook_config 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own webhook config" 
ON public.garmin_webhook_config 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhook config" 
ON public.garmin_webhook_config 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add trigger for webhook config timestamps
CREATE TRIGGER update_garmin_webhook_config_updated_at
BEFORE UPDATE ON public.garmin_webhook_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
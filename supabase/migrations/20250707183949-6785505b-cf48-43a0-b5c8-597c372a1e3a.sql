-- Create a table for temporary OAuth tokens
CREATE TABLE public.oauth_temp_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oauth_token TEXT NOT NULL UNIQUE,
  oauth_token_secret TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'garmin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '10 minutes')
);

-- Enable Row Level Security
ALTER TABLE public.oauth_temp_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert/select temp tokens (they expire in 10 minutes)
CREATE POLICY "Allow temporary token operations" 
ON public.oauth_temp_tokens 
FOR ALL 
USING (expires_at > now())
WITH CHECK (expires_at > now());

-- Create index for better performance
CREATE INDEX idx_oauth_temp_tokens_token ON public.oauth_temp_tokens(oauth_token);
CREATE INDEX idx_oauth_temp_tokens_expires ON public.oauth_temp_tokens(expires_at);

-- Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.oauth_temp_tokens WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;
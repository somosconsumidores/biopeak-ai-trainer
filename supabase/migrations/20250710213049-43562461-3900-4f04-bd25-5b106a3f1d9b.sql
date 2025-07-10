-- Migrar tabela garmin_tokens para OAuth 2.0 PKCE
-- Adicionar colunas necessárias para OAuth 2.0
ALTER TABLE public.garmin_tokens 
ADD COLUMN IF NOT EXISTS refresh_token TEXT,
ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'ACTIVITY_EXPORT',
ADD COLUMN IF NOT EXISTS expires_in INTEGER;

-- Atualizar comentários das colunas existentes para OAuth 2.0
COMMENT ON COLUMN public.garmin_tokens.access_token IS 'OAuth 2.0 Bearer access token';
COMMENT ON COLUMN public.garmin_tokens.token_secret IS 'OAuth 2.0 refresh token (stored in token_secret for backward compatibility)';
COMMENT ON COLUMN public.garmin_tokens.consumer_key IS 'OAuth 2.0 client_id';
COMMENT ON COLUMN public.garmin_tokens.oauth_verifier IS 'OAuth 2.0 authorization code used for token exchange';
COMMENT ON COLUMN public.garmin_tokens.refresh_token IS 'OAuth 2.0 refresh token';
COMMENT ON COLUMN public.garmin_tokens.scope IS 'OAuth 2.0 granted scopes';
COMMENT ON COLUMN public.garmin_tokens.expires_in IS 'Token lifetime in seconds';

-- Atualizar a tabela oauth_temp_tokens para suportar PKCE
ALTER TABLE public.oauth_temp_tokens 
ADD COLUMN IF NOT EXISTS code_verifier TEXT,
ADD COLUMN IF NOT EXISTS code_challenge TEXT;

COMMENT ON COLUMN public.oauth_temp_tokens.oauth_token IS 'For OAuth 2.0 PKCE: stores code_verifier';
COMMENT ON COLUMN public.oauth_temp_tokens.oauth_token_secret IS 'For OAuth 2.0 PKCE: stores code_challenge';
COMMENT ON COLUMN public.oauth_temp_tokens.code_verifier IS 'OAuth 2.0 PKCE code verifier';
COMMENT ON COLUMN public.oauth_temp_tokens.code_challenge IS 'OAuth 2.0 PKCE code challenge';
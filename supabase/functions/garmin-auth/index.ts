import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, authorization',
};

serve(async (req) => {
  console.log('[garmin-auth] ===== OAuth 2.0 PKCE FUNCTION STARTED =====');
  console.log('[garmin-auth] Method:', req.method);
  console.log('[garmin-auth] URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[garmin-auth] Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[garmin-auth] Entering OAuth 2.0 PKCE flow...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const clientId = Deno.env.get('GARMIN_CLIENT_ID');
    const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET');

    console.log('[garmin-auth] Environment variables check:', {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
      clientId: !!clientId,
      clientSecret: !!clientSecret
    });

    if (!supabaseUrl || !supabaseKey) {
      const missing = [];
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      throw new Error(`Missing Supabase environment variables: ${missing.join(', ')}`);
    }

    if (!clientId || !clientSecret) {
      const missing = [];
      if (!clientId) missing.push('GARMIN_CLIENT_ID');
      if (!clientSecret) missing.push('GARMIN_CLIENT_SECRET');
      console.error('[garmin-auth] Missing Garmin credentials:', missing);
      throw new Error(`Credenciais do Garmin não configuradas: ${missing.join(', ')}. Configure no painel do Supabase.`);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid token');
    }

    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error('Failed to parse request body:', error);
      throw new Error('Invalid request body - must be valid JSON');
    }

    const { code } = body;
    console.log('[garmin-auth] Received OAuth 2.0 parameters:', { 
      code: !!code,
      isOAuth2: !!code
    });

    // Only handle OAuth 2.0 flow
    if (!code) {
      throw new Error('Missing authorization code. OAuth 2.0 PKCE is required.');
    }

    console.log('[garmin-auth] Processing OAuth 2.0 PKCE flow with authorization code...');
    return await handleOAuth2Flow(code, user, supabase, clientId, clientSecret);

  } catch (error) {
    console.error('[garmin-auth] Error in OAuth 2.0 flow:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// OAuth 2.0 PKCE Flow Handler
async function handleOAuth2Flow(code: string, user: any, supabase: any, clientId: string, clientSecret: string) {
  console.log('[garmin-auth] ===== OAuth 2.0 PKCE FLOW =====');
  
  // Get stored code verifier
  const { data: pkceData, error: pkceError } = await supabase
    .from('oauth_temp_tokens')
    .select('*')
    .eq('provider', 'garmin')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (pkceError || !pkceData) {
    console.error('[garmin-auth] PKCE data not found:', pkceError);
    throw new Error('PKCE code verifier not found. Please restart the OAuth flow.');
  }

  const codeVerifier = pkceData.oauth_token;
  
  // Exchange authorization code for access token (seguindo especificação oficial)
  const tokenUrl = 'https://connectapi.garmin.com/di-oauth2-service/oauth/token';
  
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    code_verifier: codeVerifier,
    redirect_uri: 'https://preview--biopeak-ai-trainer.lovable.app/garmin'
  });

  console.log('[garmin-auth] Exchanging code for tokens...');
  
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: tokenParams.toString()
  });

  console.log('[garmin-auth] Token response status:', tokenResponse.status);

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('[garmin-auth] Token exchange failed:', errorText);
    throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  console.log('[garmin-auth] Token data received:', { 
    hasAccessToken: !!tokenData.access_token,
    hasRefreshToken: !!tokenData.refresh_token,
    expiresIn: tokenData.expires_in,
    scope: tokenData.scope
  });

  // Validate user permissions
  console.log('[garmin-auth] Validating user permissions...');
  const permissionsResponse = await fetch('https://apis.garmin.com/wellness-api/rest/user/permissions', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/json'
    }
  });

  if (permissionsResponse.ok) {
    const permissions = await permissionsResponse.json();
    console.log('[garmin-auth] User permissions:', permissions);
    
    if (!permissions.activityExport) {
      console.warn('[garmin-auth] User does not have ACTIVITY_EXPORT permission');
    }
  } else {
    console.warn('[garmin-auth] Failed to validate permissions:', permissionsResponse.status);
  }

  // Store OAuth 2.0 tokens
  const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
  
  const { error: insertError } = await supabase
    .from('garmin_tokens')
    .upsert({
      user_id: user.id,
      access_token: tokenData.access_token,
      token_secret: tokenData.refresh_token || '', // Store refresh token in token_secret for backward compatibility
      refresh_token: tokenData.refresh_token,
      consumer_key: clientId,
      oauth_verifier: code, // Store the authorization code
      scope: tokenData.scope || 'ACTIVITY_EXPORT',
      expires_in: tokenData.expires_in,
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error('[garmin-auth] Error storing OAuth 2.0 tokens:', insertError);
    throw insertError;
  }

  // Clean up PKCE data
  await supabase
    .from('oauth_temp_tokens')
    .delete()
    .eq('id', pkceData.id);

  console.log('[garmin-auth] OAuth 2.0 PKCE flow completed successfully');

  return new Response(JSON.stringify({ 
    success: true,
    message: 'Garmin Connect connected successfully via OAuth 2.0 PKCE',
    oauth2: true,
    scope: tokenData.scope,
    expiresIn: tokenData.expires_in
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
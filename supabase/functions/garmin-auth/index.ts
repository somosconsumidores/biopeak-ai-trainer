import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, authorization',
};

// OAuth 1.0 signature generation
async function generateSignature(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret = '') {
  // Create parameter string
  const sortedParams = Object.keys(params).sort().map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
  
  // Create signature base string
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  
  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  // Generate HMAC-SHA1 signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const baseData = encoder.encode(baseString);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, baseData);
  const signatureArray = new Uint8Array(signature);
  
  // Convert to base64
  const base64String = btoa(String.fromCharCode(...signatureArray));
  
  return base64String;
}

serve(async (req) => {
  console.log('[garmin-auth] ===== FUNCTION STARTED =====');
  console.log('[garmin-auth] Method:', req.method);
  console.log('[garmin-auth] URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[garmin-auth] Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[garmin-auth] Entering try block...');
    console.log('[garmin-auth] Function started');
    
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

    const { code, oauth_token, oauth_verifier } = body;
    console.log('[garmin-auth] Received OAuth parameters:', { 
      code: !!code,
      oauth_token: !!oauth_token, 
      oauth_verifier: !!oauth_verifier,
      isOAuth2: !!code,
      isOAuth1: !!(oauth_token && oauth_verifier)
    });

    // Handle OAuth 2.0 flow (new)
    if (code) {
      console.log('[garmin-auth] Processing OAuth 2.0 flow with authorization code...');
      return await handleOAuth2Flow(code, user, supabase, clientId, clientSecret);
    }
    
    // Handle OAuth 1.0a flow (legacy/demo)
    if (oauth_token && oauth_verifier) {
      console.log('[garmin-auth] Processing OAuth 1.0a flow (legacy/demo)...');
      return await handleOAuth1Flow(oauth_token, oauth_verifier, user, supabase, clientId, clientSecret);
    }

    throw new Error('Missing OAuth parameters: either code (OAuth 2.0) or oauth_token/oauth_verifier (OAuth 1.0a) are required');

  } catch (error) {
    console.error('[garmin-auth] Error in OAuth flow:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// OAuth 2.0 Flow Handler
async function handleOAuth2Flow(code: string, user: any, supabase: any, clientId: string, clientSecret: string) {
  console.log('[garmin-auth] ===== OAuth 2.0 FLOW =====');
  
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
  
  // Exchange authorization code for access token
  const tokenUrl = 'https://connectapi.garmin.com/di-oauth2-service/oauth/token';
  
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    code_verifier: codeVerifier
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
    expiresIn: tokenData.expires_in 
  });

  // Store OAuth 2.0 tokens
  const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
  
  const { error: insertError } = await supabase
    .from('garmin_tokens')
    .upsert({
      user_id: user.id,
      access_token: tokenData.access_token,
      token_secret: tokenData.refresh_token || '', // Use refresh token as secret
      consumer_key: clientId,
      oauth_verifier: code, // Store the authorization code
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

  console.log('[garmin-auth] OAuth 2.0 flow completed successfully');

  return new Response(JSON.stringify({ 
    success: true,
    message: 'Garmin Connect connected successfully via OAuth 2.0',
    oauth2: true
  }), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
  });
}

// OAuth 1.0a Flow Handler (Legacy/Demo)
async function handleOAuth1Flow(oauth_token: string, oauth_verifier: string, user: any, supabase: any, clientId: string, clientSecret: string) {
  console.log('[garmin-auth] ===== OAuth 1.0a LEGACY FLOW =====');
  
  try {
    // Check if this is a demo flow
    const isDemoFlow = oauth_token.startsWith('demo_token_') && oauth_verifier === 'demo_verifier';
    console.log('[garmin-auth] Flow type:', isDemoFlow ? 'DEMO' : 'REAL');

    if (isDemoFlow) {
      console.log('[garmin-auth] Processing demo OAuth flow...');
      
      // For demo flow, create demo tokens and store them directly
      const demoAccessToken = `demo_access_${Date.now()}`;
      const demoTokenSecret = `demo_secret_${Date.now()}`;
      
      console.log('[garmin-auth] Creating demo tokens and storing...');
      
      // Store demo tokens directly (skip OAuth exchange for demo)
      const { error: insertError } = await supabase
        .from('garmin_tokens')
        .upsert({
          user_id: user.id,
          access_token: demoAccessToken,
          token_secret: demoTokenSecret,
          consumer_key: clientId,
          oauth_verifier: oauth_verifier,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        });

      if (insertError) {
        console.error('[garmin-auth] Error storing demo tokens:', insertError);
        throw insertError;
      }

      // Clean up temp token
      await supabase
        .from('oauth_temp_tokens')
        .delete()
        .eq('oauth_token', oauth_token);

    console.log('[garmin-auth] Demo flow completed successfully');
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Garmin Connect connected successfully (demo mode)',
        isDemo: true
      }), {
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
      });
    }

    // Continue with real OAuth flow for non-demo tokens
    console.log('[garmin-auth] Processing real OAuth with token:', oauth_token.substring(0, 10) + '...');

    // Get stored request token secret from temp table
    console.log('Looking up request token in oauth_temp_tokens...');
    const { data: requestTokenData, error: tokenError } = await supabase
      .from('oauth_temp_tokens')
      .select('*')
      .eq('oauth_token', oauth_token)
      .eq('provider', 'garmin')
      .single();

    console.log('Request token lookup result:', { 
      found: !!requestTokenData, 
      error: tokenError?.message,
      tokenCount: requestTokenData ? 1 : 0
    });

    if (tokenError || !requestTokenData) {
      console.error('Request token lookup error:', tokenError);
      
      // Check if there are any temp tokens for debugging
      const { data: allTokens } = await supabase
        .from('oauth_temp_tokens')
        .select('oauth_token, provider, created_at, expires_at')
        .eq('provider', 'garmin');
      
      console.log('Available temp tokens:', allTokens);
      
      // Clean up any expired tokens
      await supabase
        .from('oauth_temp_tokens')
        .delete()
        .lt('expires_at', new Date().toISOString());
      
      throw new Error('Request token not found or expired. Please restart the OAuth flow from the beginning.');
    }

    const requestTokenSecret = requestTokenData.oauth_token_secret;

    // Step 2: Exchange for access token
    const accessTokenUrl = 'https://connectapi.garmin.com/oauth-service/oauth/access_token';
    
    const accessTokenParams = {
      oauth_consumer_key: clientId,
      oauth_token: oauth_token,
      oauth_verifier: oauth_verifier,
      oauth_nonce: Math.random().toString(36).substring(7),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0'
    };

    // Generate signature for access token
    console.log('Generating OAuth signature for access token...');
    try {
      const accessTokenSignature = await generateSignature('POST', accessTokenUrl, accessTokenParams, clientSecret, requestTokenSecret);
      accessTokenParams['oauth_signature'] = accessTokenSignature;
      console.log('OAuth signature generated successfully');
    } catch (signatureError) {
      console.error('Failed to generate OAuth signature:', signatureError);
      throw new Error(`OAuth signature generation failed: ${signatureError.message}`);
    }

    console.log('Making access token request to Garmin API...');
    console.log('Request URL:', accessTokenUrl);
    console.log('Request params (without signature):', { ...accessTokenParams, oauth_signature: '[REDACTED]' });

    // Make access token request
    const accessTokenResponse = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${Object.keys(accessTokenParams).map(key => `${key}="${encodeURIComponent(accessTokenParams[key])}"`).join(', ')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('Access token response status:', accessTokenResponse.status);
    console.log('Access token response headers:', Object.fromEntries(accessTokenResponse.headers.entries()));

    if (!accessTokenResponse.ok) {
      const errorText = await accessTokenResponse.text();
      console.error('Access token error response:', errorText);
      console.error('Full response details:', {
        status: accessTokenResponse.status,
        statusText: accessTokenResponse.statusText,
        headers: Object.fromEntries(accessTokenResponse.headers.entries())
      });
      throw new Error(`Failed to get access token from Garmin: ${accessTokenResponse.status} ${accessTokenResponse.statusText} - ${errorText}`);
    }

    const accessTokenData = await accessTokenResponse.text();
    console.log('Access token response:', accessTokenData);
    
    // Parse response
    const accessTokenParts = new URLSearchParams(accessTokenData);
    const finalAccessToken = accessTokenParts.get('oauth_token');
    const finalTokenSecret = accessTokenParts.get('oauth_token_secret');

    if (!finalAccessToken || !finalTokenSecret) {
      console.error('Missing tokens in response:', { finalAccessToken: !!finalAccessToken, finalTokenSecret: !!finalTokenSecret });
      throw new Error('Invalid access token response - missing required tokens');
    }

    console.log('Successfully parsed access tokens');

    // Delete temporary request token
    console.log('Cleaning up temporary request token...');
    const { error: deleteError } = await supabase
      .from('oauth_temp_tokens')
      .delete()
      .eq('oauth_token', oauth_token);

    if (deleteError) {
      console.warn('Failed to delete temporary token:', deleteError);
    }

    // Store final tokens
    console.log('Storing final tokens in garmin_tokens table...');
    const { error: insertError } = await supabase
      .from('garmin_tokens')
      .upsert({
        user_id: user.id,
        access_token: finalAccessToken,
        token_secret: finalTokenSecret,
        consumer_key: clientId,
        oauth_verifier: oauth_verifier,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      });

    if (insertError) {
      console.error('Error storing tokens:', insertError);
      throw insertError;
    }

    console.log('Successfully stored Garmin tokens for user:', user.id);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Garmin Connect connected successfully via OAuth 1.0a' 
    }), {
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[garmin-auth] Error in OAuth 1.0a flow:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    });
  }
}
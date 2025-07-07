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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('GARMIN_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET')!;

    if (!supabaseUrl || !supabaseKey || !clientId || !clientSecret) {
      throw new Error('Missing required environment variables');
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

    const { oauth_token, oauth_verifier } = await req.json();

    if (!oauth_token || !oauth_verifier) {
      throw new Error('Missing OAuth parameters');
    }

    console.log('Processing Garmin OAuth with token:', oauth_token);

    // Get stored request token secret from temp table
    const { data: requestTokenData, error: tokenError } = await supabase
      .from('oauth_temp_tokens')
      .select('*')
      .eq('oauth_token', oauth_token)
      .eq('provider', 'garmin')
      .single();

    if (tokenError || !requestTokenData) {
      console.error('Request token lookup error:', tokenError);
      throw new Error('Request token not found or expired. Please start the OAuth flow again.');
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
    const accessTokenSignature = await generateSignature('POST', accessTokenUrl, accessTokenParams, clientSecret, requestTokenSecret);
    accessTokenParams['oauth_signature'] = accessTokenSignature;

    console.log('Making access token request to Garmin...');

    // Make access token request
    const accessTokenResponse = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${Object.keys(accessTokenParams).map(key => `${key}="${encodeURIComponent(accessTokenParams[key])}"`).join(', ')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!accessTokenResponse.ok) {
      const errorText = await accessTokenResponse.text();
      console.error('Access token error:', errorText);
      throw new Error(`Failed to get access token: ${accessTokenResponse.status} - ${errorText}`);
    }

    const accessTokenData = await accessTokenResponse.text();
    console.log('Access token response:', accessTokenData);
    
    // Parse response
    const accessTokenParts = new URLSearchParams(accessTokenData);
    const finalAccessToken = accessTokenParts.get('oauth_token');
    const finalTokenSecret = accessTokenParts.get('oauth_token_secret');

    if (!finalAccessToken || !finalTokenSecret) {
      throw new Error('Invalid access token response');
    }

    // Delete temporary request token
    await supabase
      .from('oauth_temp_tokens')
      .delete()
      .eq('oauth_token', oauth_token);

    // Store final tokens
    const { error: insertError } = await supabase
      .from('garmin_tokens')
      .upsert({
        user_id: user.id,
        access_token: finalAccessToken,
        refresh_token: finalTokenSecret,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      });

    if (insertError) {
      console.error('Error storing tokens:', insertError);
      throw insertError;
    }

    console.log('Successfully stored Garmin tokens for user:', user.id);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Garmin Connect connected successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in garmin-auth function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
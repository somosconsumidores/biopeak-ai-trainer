import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const clientId = Deno.env.get('GARMIN_CLIENT_ID');
    const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      throw new Error('Garmin client credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Get request token
    const requestTokenUrl = 'https://connectapi.garmin.com/oauth-service/oauth/request_token';
    const redirectUri = 'https://preview--biopeak-ai-trainer.lovable.app/garmin';
    
    // Generate OAuth 1.0 parameters
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(7);
    
    const requestTokenParams = {
      oauth_consumer_key: clientId,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_version: '1.0',
      oauth_callback: redirectUri
    };

    console.log('OAuth parameters:', requestTokenParams);
    console.log('Client ID:', clientId);
    console.log('Request token URL:', requestTokenUrl);

    // Generate signature for request token
    try {
      const requestTokenSignature = await generateSignature('POST', requestTokenUrl, requestTokenParams, clientSecret);
      requestTokenParams['oauth_signature'] = requestTokenSignature;
      
      console.log('Generated signature:', requestTokenSignature);
      console.log('Making request token request to Garmin...');
    } catch (signatureError) {
      console.error('Error generating signature:', signatureError);
      throw new Error(`Failed to generate OAuth signature: ${signatureError.message}`);
    }

    // Make request token request
    const requestTokenResponse = await fetch(requestTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${Object.keys(requestTokenParams).map(key => `${key}="${encodeURIComponent(requestTokenParams[key])}"`).join(', ')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/x-www-form-urlencoded'
      }
    });

    console.log('Request token response status:', requestTokenResponse.status);
    console.log('Request token response headers:', Object.fromEntries(requestTokenResponse.headers.entries()));

    if (!requestTokenResponse.ok) {
      const errorText = await requestTokenResponse.text();
      console.error('Request token error response:', errorText);
      
      // If it's a 401, it's likely a signature issue
      if (requestTokenResponse.status === 401) {
        throw new Error(`OAuth signature verification failed. Check your client credentials and signature generation.`);
      }
      
      throw new Error(`Failed to get request token: ${requestTokenResponse.status} - ${errorText}`);
    }

    const requestTokenData = await requestTokenResponse.text();
    console.log('Request token response:', requestTokenData);
    
    // Parse response
    const requestTokenParts = new URLSearchParams(requestTokenData);
    const oauthToken = requestTokenParts.get('oauth_token');
    const oauthTokenSecret = requestTokenParts.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) {
      throw new Error('Invalid request token response');
    }

    // Store request token temporarily in database
    const { error: insertError } = await supabase
      .from('garmin_tokens')
      .upsert({
        user_id: 'temp_request_token',
        access_token: oauthToken,
        refresh_token: oauthTokenSecret,
        expires_at: new Date(Date.now() + 600000).toISOString(), // 10 minutes
      });

    if (insertError) {
      console.error('Error storing request token:', insertError);
    }

    // Create authorization URL
    const authUrl = `https://connect.garmin.com/oauthConfirm?oauth_token=${oauthToken}`;

    console.log('Generated Garmin auth URL:', authUrl);

    return new Response(JSON.stringify({ 
      authUrl,
      requestToken: oauthToken,
      requestTokenSecret: oauthTokenSecret
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in garmin-config function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
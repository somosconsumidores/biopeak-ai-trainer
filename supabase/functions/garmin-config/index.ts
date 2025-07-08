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
    
    console.log('Environment check - Garmin credentials:', {
      clientId: !!clientId,
      clientSecret: !!clientSecret
    });
    
    if (!clientId || !clientSecret) {
      console.error('Missing Garmin credentials');
      throw new Error('Garmin client credentials not configured - please check GARMIN_CLIENT_ID and GARMIN_CLIENT_SECRET');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Get request token
    const requestTokenUrl = 'https://connectapi.garmin.com/oauth-service/oauth/request_token';
    const redirectUri = 'https://preview--biopeak-ai-trainer.lovable.app/garmin-settings';
    
    // Generate OAuth 1.0 parameters with proper encoding
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(7) + Date.now().toString(36);
    
    const requestTokenParams = {
      oauth_callback: redirectUri,
      oauth_consumer_key: clientId,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_version: '1.0'
    };

    console.log('[garmin-config] OAuth parameters:', { ...requestTokenParams, oauth_consumer_key: '[REDACTED]' });
    console.log('[garmin-config] Request token URL:', requestTokenUrl);
    console.log('[garmin-config] Redirect URI:', redirectUri);

    // Generate signature for request token
    try {
      const requestTokenSignature = await generateSignature('POST', requestTokenUrl, requestTokenParams, clientSecret);
      requestTokenParams['oauth_signature'] = requestTokenSignature;
      
      console.log('[garmin-config] OAuth signature generated successfully');
    } catch (signatureError) {
      console.error('[garmin-config] Error generating signature:', signatureError);
      throw new Error(`Failed to generate OAuth signature: ${signatureError.message}`);
    }

    // Make request token request
    console.log('[garmin-config] Making request token request to Garmin...');
    
    const authHeader = 'OAuth ' + Object.keys(requestTokenParams)
      .sort()
      .map(key => `${key}="${encodeURIComponent(requestTokenParams[key])}"`)
      .join(', ');
    
    console.log('[garmin-config] Authorization header prepared');
    
    const requestTokenResponse = await fetch(requestTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/x-www-form-urlencoded',
        'User-Agent': 'BioPeak-Garmin-Integration/1.0'
      }
    });

    console.log('[garmin-config] Request token response status:', requestTokenResponse.status);
    
    if (!requestTokenResponse.ok) {
      const errorText = await requestTokenResponse.text();
      console.error('[garmin-config] Request token error response:', errorText);
      console.error('[garmin-config] Full response details:', {
        status: requestTokenResponse.status,
        statusText: requestTokenResponse.statusText,
        headers: Object.fromEntries(requestTokenResponse.headers.entries())
      });
      
      // Provide more specific error messages
      if (requestTokenResponse.status === 401) {
        throw new Error('Credenciais do Garmin inválidas. Verifique GARMIN_CLIENT_ID e GARMIN_CLIENT_SECRET nas configurações do Supabase.');
      } else if (requestTokenResponse.status === 400) {
        throw new Error('Parâmetros OAuth inválidos. Verifique a configuração da aplicação no Garmin Developer Console.');
      } else {
        throw new Error(`Erro do Garmin Connect: ${requestTokenResponse.status} ${requestTokenResponse.statusText}`);
      }
    }

    const requestTokenData = await requestTokenResponse.text();
    console.log('[garmin-config] Request token response data received:', requestTokenData.length, 'characters');
    
    // Parse response
    const requestTokenParts = new URLSearchParams(requestTokenData);
    const oauthToken = requestTokenParts.get('oauth_token');
    const oauthTokenSecret = requestTokenParts.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) {
      console.error('[garmin-config] Missing tokens in response:', { 
        oauthToken: !!oauthToken, 
        oauthTokenSecret: !!oauthTokenSecret,
        responseData: requestTokenData
      });
      throw new Error('Resposta inválida do Garmin - tokens OAuth não encontrados');
    }

    console.log('[garmin-config] Successfully parsed request tokens');
    
    // Validate token format (OAuth 1.0 tokens should be non-UUID format)
    if (oauthToken.includes('-') && oauthToken.length === 36) {
      console.error('[garmin-config] Received UUID-like token - this indicates a configuration issue');
      throw new Error('Token inválido recebido do Garmin. Verifique a configuração da aplicação.');
    }

    // Clean up expired tokens first
    console.log('[garmin-config] Cleaning up expired tokens...');
    const { error: cleanupError } = await supabase
      .from('oauth_temp_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString());
    
    if (cleanupError) {
      console.warn('[garmin-config] Failed to cleanup expired tokens:', cleanupError);
    }

    // Store request token temporarily in oauth_temp_tokens table
    console.log('[garmin-config] Storing temporary request token...');
    const { error: insertError } = await supabase
      .from('oauth_temp_tokens')
      .upsert({
        oauth_token: oauthToken,
        oauth_token_secret: oauthTokenSecret,
        provider: 'garmin',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
      });

    if (insertError) {
      console.error('[garmin-config] Error storing request token:', insertError);
      throw new Error(`Erro ao armazenar token temporário: ${insertError.message}`);
    }

    // Create authorization URL
    const authUrl = `https://connect.garmin.com/oauthConfirm?oauth_token=${encodeURIComponent(oauthToken)}`;

    console.log('[garmin-config] Generated Garmin auth URL successfully');
    console.log('[garmin-config] Stored temporary token with 10-minute expiration');

    return new Response(JSON.stringify({ 
      success: true,
      authUrl,
      message: 'Token de autorização gerado com sucesso. Redirecionando para o Garmin Connect...',
      webhookInfo: {
        url: 'https://qytorkjmzxscyaefkhnk.supabase.co/functions/v1/garmin-webhook',
        note: 'Configure este URL no Garmin Developer Console para webhooks automáticos'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[garmin-config] Error in garmin-config function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      help: 'Se o problema persistir, verifique as credenciais do Garmin no Supabase e a configuração da aplicação no Garmin Developer Console.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
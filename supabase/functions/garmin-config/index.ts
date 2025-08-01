import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

// OAuth 2.0 PKCE utilities
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[garmin-config] ===== OAUTH 2.0 PKCE FLOW STARTED =====');
  console.log('[garmin-config] Method:', req.method);
  console.log('[garmin-config] URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[garmin-config] Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[garmin-config] Entering OAuth 2.0 flow...');
    
    // Get environment variables safely
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const clientId = Deno.env.get('GARMIN_CLIENT_ID');
    const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET');
    
    console.log('[garmin-config] ===== CREDENTIAL DIAGNOSTIC =====');
    console.log('[garmin-config] Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId?.length || 0,
      clientSecretLength: clientSecret?.length || 0
    });
    console.log('[garmin-config] ===============================');
    
    // Check for missing Supabase credentials first
    if (!supabaseUrl || !supabaseKey) {
      const missing = [];
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      
      console.error('[garmin-config] Missing Supabase credentials:', missing);
      throw new Error(`Credenciais do Supabase não configuradas: ${missing.join(', ')}`);
    }
    
    // Check for missing Garmin credentials
    if (!clientId || !clientSecret) {
      const missing = [];
      if (!clientId) missing.push('GARMIN_CLIENT_ID');
      if (!clientSecret) missing.push('GARMIN_CLIENT_SECRET');
      
      console.error('[garmin-config] ===== CREDENTIAL ERROR =====');
      console.error('[garmin-config] Missing Garmin credentials:', missing);
      console.error('[garmin-config] Please configure these secrets in Supabase');
      console.error('[garmin-config] ============================');
      
      return new Response(JSON.stringify({ 
        success: false,
        error: `Credenciais do Garmin não configuradas: ${missing.join(', ')}. Configure no painel do Supabase em Settings > Edge Functions.`,
        help: 'Acesse o Garmin Developer Console para obter suas credenciais',
        missing: missing
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Validate credential format - be more flexible with validation
    if (clientId.length < 5 || clientSecret.length < 10) {
      console.error('[garmin-config] ===== CREDENTIAL FORMAT ERROR =====');
      console.error('[garmin-config] Credentials appear to be invalid format');
      console.error('[garmin-config] Client ID length:', clientId.length, '(expected > 5)');
      console.error('[garmin-config] Client Secret length:', clientSecret.length, '(expected > 10)');
      console.error('[garmin-config] ==============================');
      
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Credenciais do Garmin parecem ter formato inválido. Verifique se estão corretas no Garmin Developer Console.',
        help: 'As credenciais devem ser copiadas exatamente como aparecem no Garmin Developer Console'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('[garmin-config] ✅ Credentials appear valid, proceeding with OAuth 2.0 PKCE...');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // OAuth 2.0 PKCE Flow - Generate code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    console.log('[garmin-config] Generated OAuth 2.0 PKCE parameters:', {
      codeVerifierLength: codeVerifier.length,
      codeChallengeLength: codeChallenge.length
    });
    
    // Clean up expired tokens first
    console.log('[garmin-config] Cleaning up expired PKCE data...');
    const { error: cleanupError } = await supabase
      .from('oauth_temp_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString());
    
    if (cleanupError) {
      console.warn('[garmin-config] Failed to cleanup expired tokens:', cleanupError);
    }
    
    // Store code verifier temporarily for token exchange
    console.log('[garmin-config] Storing PKCE parameters...');
    const { error: insertError } = await supabase
      .from('oauth_temp_tokens')
      .insert({
        oauth_token: codeVerifier, // Store verifier as token for retrieval
        oauth_token_secret: codeChallenge, // Store challenge as secret
        provider: 'garmin',
        expires_at: new Date(Date.now() + 600000).toISOString() // 10 minutes
      });

    if (insertError) {
      console.error('[garmin-config] Error storing PKCE parameters:', insertError);
      throw new Error(`Erro ao armazenar parâmetros PKCE: ${insertError.message}`);
    }

    // OAuth 2.0 Authorization URL with PKCE (seguindo especificação oficial)
    const redirectUri = 'https://preview--biopeak-ai-trainer.lovable.app/garmin';
    
    console.log('[garmin-config] ===== OAUTH 2.0 URL GENERATION =====');
    console.log('[garmin-config] Redirect URI:', redirectUri);
    console.log('[garmin-config] Client ID:', clientId);
    console.log('[garmin-config] Code Challenge:', `${codeChallenge.substring(0, 10)}...`);
    console.log('[garmin-config] Code Verifier stored:', `${codeVerifier.substring(0, 10)}...`);
    console.log('[garmin-config] ======================================');
    
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      redirect_uri: redirectUri
    });

    const authUrl = `https://connect.garmin.com/oauth2Confirm?${authParams.toString()}`;
    
    console.log('[garmin-config] Generated OAuth 2.0 authorization URL');
    console.log('[garmin-config] Redirect URI:', redirectUri);
    console.log('[garmin-config] Scope:', 'read');
    console.log('[garmin-config] PKCE Method:', 'S256');

    return new Response(JSON.stringify({ 
      success: true,
      authUrl,
      oauth2: true,
      message: 'OAuth 2.0 PKCE flow iniciado com sucesso. Redirecionando para o Garmin Connect...',
      webhookInfo: {
        url: 'https://qytorkjmzxscyaefkhnk.supabase.co/functions/v1/garmin-webhook',
        note: 'Configure este URL no Garmin Developer Console para webhooks automáticos'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[garmin-config] Error in OAuth 2.0 flow:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      help: 'OAuth 2.0 é obrigatório para a API Garmin. Verifique as credenciais no Supabase e a configuração no Garmin Developer Console.',
      migration: 'Esta aplicação agora usa OAuth 2.0 PKCE em vez de OAuth 1.0a obsoleto'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
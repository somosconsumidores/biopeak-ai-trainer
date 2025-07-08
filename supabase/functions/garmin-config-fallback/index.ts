import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[garmin-config-fallback] Creating demo OAuth flow...');

    // Generate demo tokens
    const demoOauthToken = `demo_token_${Date.now()}`;
    const demoOauthTokenSecret = `demo_secret_${Date.now()}`;

    // Store demo tokens temporarily
    const { error: insertError } = await supabase
      .from('oauth_temp_tokens')
      .upsert({
        oauth_token: demoOauthToken,
        oauth_token_secret: demoOauthTokenSecret,
        provider: 'garmin',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
      });

    if (insertError) {
      console.error('[garmin-config-fallback] Error storing demo token:', insertError);
      throw new Error(`Erro ao criar token de demonstração: ${insertError.message}`);
    }

    // Create demo auth URL that will trigger immediate callback
    const redirectUri = 'https://preview--biopeak-ai-trainer.lovable.app/garmin-settings';
    const authUrl = `${redirectUri}?oauth_token=${demoOauthToken}&oauth_verifier=demo_verifier`;

    console.log('[garmin-config-fallback] Demo flow created successfully');

    return new Response(JSON.stringify({ 
      success: true,
      authUrl,
      message: 'Fluxo de demonstração criado. Redirecionando...',
      isDemo: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[garmin-config-fallback] Error in fallback function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
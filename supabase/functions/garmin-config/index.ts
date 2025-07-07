import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const clientId = Deno.env.get('GARMIN_CLIENT_ID');
    
    if (!clientId) {
      throw new Error('Garmin client ID not configured');
    }

    const redirectUri = 'https://preview--biopeak-ai-trainer.lovable.app/garmin';
    const scope = 'activity:read';
    const state = 'garmin_auth';

    const authUrl = `https://connect.garmin.com/oauthConfirm?` +
      `oauth_callback=${encodeURIComponent(redirectUri)}&` +
      `oauth_consumer_key=${clientId}&` +
      `oauth_signature_method=HMAC-SHA1&` +
      `oauth_timestamp=${Math.floor(Date.now() / 1000)}&` +
      `oauth_nonce=${Math.random().toString(36).substring(7)}&` +
      `oauth_version=1.0&` +
      `oauth_signature=dummy_signature`;

    console.log('Generated Garmin auth URL:', authUrl);

    return new Response(JSON.stringify({ 
      authUrl,
      clientId,
      redirectUri 
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
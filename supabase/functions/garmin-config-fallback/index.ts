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
    const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      throw new Error('Garmin client credentials not configured');
    }

    console.log('Garmin config - Fallback mode');
    console.log('Client ID configured:', !!clientId);
    console.log('Client Secret configured:', !!clientSecret);

    // Create a simulated authorization URL for development/testing
    // In production, you would implement the full OAuth 1.0 flow
    const redirectUri = 'https://preview--biopeak-ai-trainer.lovable.app/garmin';
    const mockToken = 'demo_' + Math.random().toString(36).substring(7);
    
    // For demo purposes, create a URL that will redirect back with mock parameters
    const authUrl = `${redirectUri}?oauth_token=${mockToken}&oauth_verifier=demo_verifier`;

    console.log('Generated demo auth URL:', authUrl);

    return new Response(JSON.stringify({ 
      authUrl,
      requestToken: mockToken,
      requestTokenSecret: 'demo_secret',
      mode: 'demo'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in garmin-config-fallback function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
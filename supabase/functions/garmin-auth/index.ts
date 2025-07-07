import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, authorization',
};

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

    const { code, redirect_uri } = await req.json();

    if (!code) {
      throw new Error('No authorization code provided');
    }

    console.log('Processing Garmin OAuth with code:', code);

    // For now, we'll simulate the token exchange since Garmin Connect API requires OAuth 1.0
    // In a real implementation, you would need to implement OAuth 1.0 signature generation
    const mockTokenData = {
      access_token: 'garmin_' + code + '_' + Date.now(),
      refresh_token: 'refresh_' + code + '_' + Date.now(),
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
    };

    // Store tokens in database
    const { error: insertError } = await supabase
      .from('garmin_tokens')
      .upsert({
        user_id: user.id,
        access_token: mockTokenData.access_token,
        refresh_token: mockTokenData.refresh_token,
        expires_at: mockTokenData.expires_at,
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
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

    console.log('=== Garmin Sync All Function Started ===');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    console.log('Verifying JWT token...');
    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('JWT verification failed:', authError);
      throw new Error('Invalid or expired JWT token');
    }

    console.log('JWT verified successfully for user:', user.id);

    // Get user's Garmin tokens
    console.log('Fetching Garmin tokens for user...');
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      console.error('Garmin tokens not found:', tokenError);
      throw new Error('No Garmin connection found. Please connect your Garmin account first.');
    }

    // Enhanced token validation
    if (!tokenData.access_token || !tokenData.token_secret) {
      throw new Error('Invalid Garmin tokens. Please reconnect your Garmin account.');
    }

    // Check if tokens are expired
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      throw new Error('Garmin tokens have expired. Please reconnect your Garmin account.');
    }

    console.log('Garmin tokens validated successfully');

    // Call the regular garmin-sync function with downloadAll flag
    const syncResponse = await supabase.functions.invoke('garmin-sync', {
      body: { downloadAll: true },
      headers: {
        Authorization: authHeader
      }
    });

    if (syncResponse.error) {
      throw syncResponse.error;
    }

    // Enhanced response with progress information
    const responseMessage = {
      success: true,
      message: "Download completo de atividades históricas iniciado",
      syncStatus: 'download_all_initiated',
      data: syncResponse.data,
      timestamp: new Date().toISOString()
    };

    console.log('=== Garmin Sync All Completed ===');
    console.log('Final result:', responseMessage);

    return new Response(JSON.stringify(responseMessage), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== Garmin Sync All Error ===');
    console.error('Error details:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      syncStatus: 'error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
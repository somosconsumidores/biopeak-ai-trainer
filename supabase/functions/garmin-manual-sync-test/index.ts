import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { fetchGarminUserMetrics } from '../garmin-sync/garmin-api.ts';
import { processUserMetricsData } from '../garmin-sync/data-processor.ts';
import { insertGarminVo2Max } from '../garmin-sync/database-operations.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('GARMIN_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET')!;

    console.log('=== Garmin VO2 Max Sync Test ===');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user tokens
    const { data: tokens, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('expires_at', supabase.raw('(SELECT MAX(expires_at) FROM garmin_tokens WHERE expires_at > NOW())'))
      .single();

    if (tokenError || !tokens) {
      console.error('No valid tokens found:', tokenError);
      return new Response(JSON.stringify({ error: 'No valid Garmin tokens found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Found valid token for user:', tokens.user_id);

    // Test User Metrics API for VO2 Max
    console.log('=== Testing User Metrics API ===');
    const { data: userMetricsData, lastError: userMetricsError } = await fetchGarminUserMetrics(
      tokens.access_token,
      tokens.token_secret,
      clientId,
      clientSecret
    );

    if (userMetricsData && userMetricsData.length > 0) {
      console.log(`Found ${userMetricsData.length} user metrics records`);
      console.log('Sample data:', JSON.stringify(userMetricsData[0], null, 2));

      // Process VO2 Max data
      const processedVo2MaxData = processUserMetricsData(userMetricsData, tokens.user_id);
      console.log(`Processed ${processedVo2MaxData.length} VO2 Max records`);

      if (processedVo2MaxData.length > 0) {
        // Insert into database
        const insertResult = await insertGarminVo2Max(supabase, processedVo2MaxData);
        console.log('Insert result:', insertResult);

        return new Response(JSON.stringify({
          success: true,
          message: `Successfully synced ${processedVo2MaxData.length} VO2 Max records`,
          data: processedVo2MaxData
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          message: 'No VO2 Max data found in user metrics',
          rawData: userMetricsData
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      console.error('User Metrics API failed:', userMetricsError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch user metrics data',
        details: userMetricsError
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error in manual sync test:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
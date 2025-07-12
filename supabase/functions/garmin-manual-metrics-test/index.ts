import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Testing userMetrics endpoint with timestamps: 1751994000, 1752080400');
    
    // Get test user tokens
    const { data: tokens, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', 'd0f0c519-dc4c-4f3e-a7f4-114834fd1f4d')
      .single();

    if (tokenError || !tokens) {
      console.error('Failed to get tokens:', tokenError);
      return new Response(JSON.stringify({ error: 'No tokens found' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Found tokens for user');

    // Test userMetrics API call
    const startTime = 1751994000;
    const endTime = 1752080400;
    
    const startDate = new Date(startTime * 1000);
    const endDate = new Date(endTime * 1000);
    
    console.log(`Testing userMetrics from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const url = `https://apis.garmin.com/wellness-api/rest/userMetrics?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`;
    console.log('Making request to:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `OAuth oauth_consumer_key="${Deno.env.get('GARMIN_CLIENT_ID')}", oauth_token="${tokens.access_token}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="${Math.floor(Date.now() / 1000)}", oauth_nonce="${Math.random().toString(36)}", oauth_version="1.0", oauth_signature="${encodeURIComponent(generateSignature(url, tokens.token_secret))}"`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Response body:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText, parseError: e.message };
    }

    const result = {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      timestamps: {
        start: startTime,
        end: endTime,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    };

    console.log('Final result:', JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Test failed:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generateSignature(url: string, tokenSecret: string): string {
  // Simplified signature generation for testing
  const consumerSecret = Deno.env.get('GARMIN_CLIENT_SECRET') || '';
  const key = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  // This is a simplified version - in production you'd need proper HMAC-SHA1
  return btoa(key + url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
}
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Inline Garmin API functions
async function makeGarminApiCall(url: string, accessToken: string, tokenSecret: string, clientId: string, clientSecret: string) {
  console.log(`Making OAuth 2.0 call to: ${url}`);
  
  if (!accessToken || accessToken.includes('demo_') || (accessToken.includes('-') && accessToken.length === 36)) {
    throw new Error('Invalid access token - please reconnect your Garmin account');
  }

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    'User-Agent': 'BioPeak/1.0'
  };

  const response = await fetch(url, {
    method: 'GET',
    headers
  });

  console.log('Response status:', response.status);
  return response;
}

function getGarminUserMetricsEndpoints() {
  const baseUrl = 'https://apis.garmin.com';
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const uploadStartTime24h = Math.floor(yesterday.getTime() / 1000);
  const uploadEndTime = Math.floor(now.getTime() / 1000);
  
  return [
    `${baseUrl}/wellness-api/rest/userMetrics?uploadStartTimeInSeconds=${uploadStartTime24h}&uploadEndTimeInSeconds=${uploadEndTime}`,
    `${baseUrl}/wellness-api/rest/userMetrics?startDate=${thirtyDaysAgo.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`,
    `${baseUrl}/wellness-api/rest/userMetrics`
  ];
}

async function fetchGarminUserMetrics(accessToken: string, tokenSecret: string, clientId: string, clientSecret: string) {
  const endpoints = getGarminUserMetricsEndpoints();
  let data = null;
  let lastError = null;
  
  console.log('=== TESTING USER METRICS ENDPOINTS ===');
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing endpoint: ${endpoint}`);
      const response = await makeGarminApiCall(endpoint, accessToken, tokenSecret, clientId, clientSecret);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ SUCCESS! User Metrics endpoint working');
        console.log('Response preview:', JSON.stringify(responseData, null, 2).substring(0, 500));
        
        if (Array.isArray(responseData)) {
          data = responseData;
        } else if (responseData && typeof responseData === 'object') {
          data = responseData.data || [responseData];
        }
        break;
      } else {
        const errorText = await response.text();
        console.error(`❌ Endpoint failed: ${response.status} - ${errorText}`);
        lastError = `HTTP ${response.status}: ${errorText}`;
      }
    } catch (error) {
      console.error(`💥 Exception on endpoint ${endpoint}:`, error);
      lastError = error.message;
    }
  }
  
  return { data, lastError };
}

// Inline data processor functions
function processUserMetricsData(userMetricsData: any[], userId: string) {
  console.log('=== PROCESSING USER METRICS DATA ===');
  console.log(`Input: ${userMetricsData?.length || 0} user metrics records`);
  
  if (!userMetricsData || !Array.isArray(userMetricsData)) {
    console.log('❌ Invalid user metrics data format');
    return [];
  }

  const vo2MaxRecords = [];
  
  for (const record of userMetricsData) {
    console.log('Processing record:', JSON.stringify(record, null, 2));
    
    if (record.vo2Max && typeof record.vo2Max === 'number') {
      const vo2MaxRecord = {
        user_id: userId,
        vo2_max_value: record.vo2Max,
        measurement_date: record.calendarDate || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      vo2MaxRecords.push(vo2MaxRecord);
      console.log('✅ Found VO2 Max:', vo2MaxRecord);
    }
    
    // Also check for cycling VO2 Max
    if (record.vo2MaxCycling && typeof record.vo2MaxCycling === 'number') {
      const vo2MaxCyclingRecord = {
        user_id: userId,
        vo2_max_value: record.vo2MaxCycling,
        measurement_date: record.calendarDate || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      vo2MaxRecords.push(vo2MaxCyclingRecord);
      console.log('✅ Found VO2 Max Cycling:', vo2MaxCyclingRecord);
    }
  }
  
  console.log(`📊 Processed ${vo2MaxRecords.length} VO2 Max records from ${userMetricsData.length} user metrics records`);
  return vo2MaxRecords;
}

// Inline database operations
async function insertGarminVo2Max(supabase: any, vo2MaxData: any[]) {
  if (!vo2MaxData || vo2MaxData.length === 0) {
    console.log('No VO2 Max data to insert');
    return { success: true, insertedCount: 0 };
  }

  console.log(`Attempting to insert ${vo2MaxData.length} VO2 Max records`);

  try {
    const { data, error } = await supabase
      .from('garmin_vo2_max')
      .upsert(vo2MaxData, {
        onConflict: 'user_id,measurement_date',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('❌ Error inserting VO2 Max data:', error);
      throw error;
    }

    console.log(`✅ Successfully inserted ${data?.length || 0} VO2 Max records`);
    return { success: true, insertedCount: data?.length || 0, data };
  } catch (error) {
    console.error('💥 Exception inserting VO2 Max data:', error);
    throw error;
  }
}

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
          data: processedVo2MaxData,
          insertResult
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
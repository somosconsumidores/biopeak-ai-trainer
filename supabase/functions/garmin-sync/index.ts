import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { fetchGarminActivities, fetchGarminDailyHealth, checkGarminPermissions } from './garmin-api.ts';
import { processGarminActivities, processDailyHealthData, createFallbackActivities, createFallbackDailyHealth } from './data-processor.ts';
import { insertGarminActivities, insertGarminDailyHealth, verifyInsertedData } from './database-operations.ts';

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

    console.log('=== Garmin Sync Function Started ===');
    console.log('Environment variables check:', {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
      clientId: !!clientId,
      clientSecret: !!clientSecret
    });

    if (!supabaseUrl || !supabaseKey || !clientId || !clientSecret) {
      const missing = [];
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      if (!clientId) missing.push('GARMIN_CLIENT_ID');
      if (!clientSecret) missing.push('GARMIN_CLIENT_SECRET');
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
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

    // Get user's Garmin tokens with detailed validation
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
      console.error('Invalid token structure:', {
        hasAccessToken: !!tokenData.access_token,
        hasTokenSecret: !!tokenData.token_secret
      });
      
      // Clean up invalid tokens
      await supabase
        .from('garmin_tokens')
        .delete()
        .eq('user_id', user.id);
      
      throw new Error('Tokens inválidos do Garmin detectados e removidos. Por favor, conecte novamente sua conta Garmin.');
    }

    // Check for demo/UUID tokens (these are invalid OAuth 1.0 tokens)
    if (tokenData.access_token.includes('-') && tokenData.access_token.length === 36) {
      console.error('Demo tokens detected - user needs to complete OAuth flow');
      
      // Clean up demo tokens
      await supabase
        .from('garmin_tokens')
        .delete()
        .eq('user_id', user.id);
      
      throw new Error('Tokens de demonstração detectados e removidos. Por favor, complete o processo de autorização do Garmin Connect novamente.');
    }

    // Additional validation for OAuth 1.0 token format
    if (tokenData.access_token.length < 10 || tokenData.token_secret.length < 10) {
      console.error('Token format appears invalid:', {
        accessTokenLength: tokenData.access_token.length,
        tokenSecretLength: tokenData.token_secret.length
      });
      
      // Clean up invalid format tokens
      await supabase
        .from('garmin_tokens')
        .delete()
        .eq('user_id', user.id);
      
      throw new Error('Formato de token inválido detectado e removido. Por favor, reconecte sua conta Garmin.');
    }

    // Check if tokens are expired
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      console.error('Tokens expired:', { expiresAt, now });
      throw new Error('Garmin tokens have expired. Please reconnect your Garmin account.');
    }

    // Token validation passed
    console.log('Garmin tokens validated successfully');
    console.log('Token expires at:', tokenData.expires_at);


    const accessToken = tokenData.access_token;
    const tokenSecret = tokenData.token_secret;

    // Clean up any demo activities first
    console.log('Cleaning up demo activities...');
    const { error: cleanupError } = await supabase
      .from('garmin_activities')
      .delete()
      .eq('user_id', user.id)
      .like('name', '%Demo%');

    if (cleanupError) {
      console.warn('Failed to cleanup demo activities:', cleanupError);
    } else {
      console.log('Demo activities cleaned up successfully');
    }

    // Check user permissions first
    console.log('Checking Garmin API permissions...');
    const { permissions } = await checkGarminPermissions(accessToken, tokenSecret, clientId, clientSecret);
    
    // Try to fetch data from both APIs
    console.log('Attempting to fetch data from both Garmin APIs...');
    
    // Fetch activities from Activity API
    const { data: activitiesData, lastError: activitiesError } = await fetchGarminActivities(
      accessToken, tokenSecret, clientId, clientSecret
    );
    
    // Fetch daily health data from Daily Health Stats API
    const { data: healthData, lastError: healthError } = await fetchGarminDailyHealth(
      accessToken, tokenSecret, clientId, clientSecret
    );

    let processedActivities = [];
    let processedHealthData = [];
    let syncStatus = 'unknown';
    let lastError = null;
    
    // Process activities data
    if (activitiesData && Array.isArray(activitiesData) && activitiesData.length > 0) {
      console.log(`Processing ${activitiesData.length} real activities from Activity API`);
      processedActivities = processGarminActivities(activitiesData, user.id);
      syncStatus = 'activity_api_success';
    } else if (activitiesError) {
      lastError = activitiesError;
      console.log('Activity API failed:', activitiesError);
    }
    
    // Process daily health data
    if (healthData && Array.isArray(healthData) && healthData.length > 0) {
      console.log(`Processing ${healthData.length} daily health records from Daily Health Stats API`);
      processedHealthData = processDailyHealthData(healthData, user.id);
      if (syncStatus === 'activity_api_success') {
        syncStatus = 'both_apis_success';
      } else {
        syncStatus = 'health_api_success';
      }
    } else if (healthError) {
      lastError = lastError || healthError;
      console.log('Daily Health Stats API failed:', healthError);
    }
    
    // If both APIs failed, check for existing data or create fallback
    if (processedActivities.length === 0 && processedHealthData.length === 0) {
      console.log('Both APIs failed, checking for existing data...');
      syncStatus = 'apis_failed';
      
      const { data: existingActivities } = await supabase
        .from('garmin_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
        
      const { data: existingHealth } = await supabase
        .from('garmin_daily_health')
        .select('*')
        .eq('user_id', user.id)
        .order('summary_date', { ascending: false })
        .limit(5);

      if ((existingActivities && existingActivities.length > 0) || 
          (existingHealth && existingHealth.length > 0)) {
        console.log('Found existing data from webhooks');
        syncStatus = 'webhook_data_available';
      } else {
        // Create minimal demo data for UI testing
        console.log('No existing data found, creating demo data for UI testing');
        syncStatus = 'demo_fallback';
        processedActivities = createFallbackActivities(user.id).slice(0, 1);
        processedHealthData = createFallbackDailyHealth(user.id).slice(0, 3);
      }
    }

    // Insert data into database
    let insertedActivities = 0;
    let insertedHealthRecords = 0;
    
    if (processedActivities.length > 0) {
      console.log(`Inserting ${processedActivities.length} activities into database...`);
      await insertGarminActivities(supabase, processedActivities);
      insertedActivities = processedActivities.length;
    }
    
    if (processedHealthData.length > 0) {
      console.log(`Inserting ${processedHealthData.length} daily health records into database...`);
      await insertGarminDailyHealth(supabase, processedHealthData);
      insertedHealthRecords = processedHealthData.length;
    }
    
    // Verify insertion
    if (insertedActivities > 0 || insertedHealthRecords > 0) {
      await verifyInsertedData(supabase, user.id);
    }

    // Get final counts
    const [{ data: activityCount }, { data: healthCount }] = await Promise.all([
      supabase.from('garmin_activities').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('garmin_daily_health').select('id', { count: 'exact' }).eq('user_id', user.id)
    ]);

    const responseMessage = {
      success: true,
      syncStatus,
      processedActivities: insertedActivities,
      processedHealthRecords: insertedHealthRecords,
      totalActivities: activityCount?.length || 0,
      totalHealthRecords: healthCount?.length || 0,
      message: getSyncMessage(syncStatus, insertedActivities, insertedHealthRecords),
      lastError: lastError || null,
      recommendation: getRecommendation(syncStatus),
      permissions: permissions || null,
      timestamp: new Date().toISOString()
    };

    console.log('=== Garmin Sync Completed ===');
    console.log('Final result:', responseMessage);

    return new Response(JSON.stringify(responseMessage), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== Garmin Sync Error ===');
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

function getSyncMessage(status: string, activityCount: number, healthCount: number = 0): string {
  switch (status) {
    case 'both_apis_success':
      return `Successfully synced ${activityCount} activities and ${healthCount} daily health records from both Garmin APIs`;
    case 'activity_api_success':
      return `Successfully synced ${activityCount} activities from Garmin Activity API`;
    case 'health_api_success':
      return `Successfully synced ${healthCount} daily health records from Garmin Daily Health Stats API`;
    case 'apis_failed':
      return 'Both Garmin APIs failed, but webhook system may be handling real-time data';
    case 'webhook_data_available':
      return 'Using existing webhook data. Manual sync not needed as webhooks are working';
    case 'demo_fallback':
      return `APIs unavailable - ${activityCount} demo activities and ${healthCount} demo health records created`;
    default:
      return 'Sync completed with unknown status';
  }
}

function getRecommendation(status: string): string {
  switch (status) {
    case 'both_apis_success':
      return 'Both APIs working perfectly! Data will continue via webhooks.';
    case 'activity_api_success':
      return 'Activity API working. Check Daily Health Stats API permissions if health data is needed.';
    case 'health_api_success':
      return 'Daily Health Stats API working. Check Activity API permissions if activity data is needed.';
    case 'apis_failed':
      return 'Check Garmin API credentials and permissions for both Activity and Daily Health Stats APIs.';
    case 'webhook_data_available':
      return 'Webhook system working correctly. New data will appear automatically.';
    case 'demo_fallback':
      return 'Reconnect Garmin account and verify API permissions in Garmin Developer Console.';
    default:
      return 'Check system status and try again.';
  }
}
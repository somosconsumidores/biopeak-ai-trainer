import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { fetchGarminActivities } from './garmin-api.ts';
import { createFallbackActivities } from './data-processor.ts';
import { insertGarminActivities, verifyInsertedData } from './database-operations.ts';

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
    // Parse request body if present
    let requestBody = {};
    try {
      const contentType = req.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        requestBody = await req.json();
      }
    } catch (e) {
      // Ignore JSON parsing errors for requests without body
    }
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
      throw new Error('Invalid Garmin tokens. Please reconnect your Garmin account.');
    }

    // Check for demo/UUID tokens
    if (tokenData.access_token.includes('-') && tokenData.access_token.length === 36) {
      console.error('Demo tokens detected - user needs to complete OAuth flow');
      throw new Error('Demo tokens detected. Please complete the Garmin Connect authorization process.');
    }

    // Check if tokens are expired
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      console.error('Tokens expired:', { expiresAt, now });
      throw new Error('Garmin tokens have expired. Please reconnect your Garmin account.');
    }

    // Validate OAuth 1.0 token format (should not look like OAuth 2.0)
    if (tokenData.access_token.length < 10 || tokenData.token_secret.length < 10) {
      console.error('Token format appears invalid:', {
        accessTokenLength: tokenData.access_token.length,
        tokenSecretLength: tokenData.token_secret.length
      });
      throw new Error('Invalid token format. Please reconnect your Garmin account.');
    }

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

    // Check if this is a request for downloading all historical activities
    const downloadAll = requestBody?.downloadAll || false;
    console.log('Download all historical activities:', downloadAll);

    // Try to fetch real activities from Garmin API
    console.log('Attempting to fetch activities from Garmin API...');
    const { activitiesData, lastError } = await fetchGarminActivities(
      accessToken, 
      tokenSecret, 
      clientId, 
      clientSecret,
      downloadAll
    );

    let processedActivities = [];
    let syncStatus = 'unknown';
    
    if (activitiesData && Array.isArray(activitiesData) && activitiesData.length > 0) {
      // Process real data if available
      console.log(`Processing ${activitiesData.length} real activities from Garmin API`);
      syncStatus = 'api_success';
      
      processedActivities = activitiesData.map((activity: any, index: number) => {
        // Map official API response fields to our database structure
        const activityId = activity.activityId || activity.summaryId || (Date.now() + index);
        
        return {
          user_id: user.id,
          garmin_activity_id: parseInt(activityId.toString()) || (Date.now() + index),
          name: activity.activityName || `${activity.activityType || 'Activity'} ${index + 1}`,
          type: (activity.activityType || 'unknown').toLowerCase(),
          start_date: activity.startTimeInSeconds 
            ? new Date(activity.startTimeInSeconds * 1000).toISOString() 
            : new Date().toISOString(),
          distance: activity.distanceInMeters || null,
          moving_time: activity.durationInSeconds || null,
          elapsed_time: activity.durationInSeconds || null,
          average_speed: activity.averageSpeedInMetersPerSecond || null,
          max_speed: activity.maxSpeedInMetersPerSecond || null,
          average_heartrate: activity.averageHeartRateInBeatsPerMinute || null,
          max_heartrate: activity.maxHeartRateInBeatsPerMinute || null,
          calories: activity.activeKilocalories || null,
          total_elevation_gain: activity.totalElevationGainInMeters || null,
        };
      });
    } else {
      // API failed, check if we should use webhook data instead
      console.log('Garmin API failed, checking for existing webhook data...');
      syncStatus = 'api_failed';
      
      const { data: existingActivities } = await supabase
        .from('garmin_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (existingActivities && existingActivities.length > 0) {
        console.log(`Found ${existingActivities.length} existing activities from webhook data`);
        syncStatus = 'webhook_data_available';
        processedActivities = []; // Don't add demo data if we have real webhook data
      } else {
        // Only create demo data if no webhook data exists
        console.log('No existing data found, creating minimal demo data for UI testing');
        syncStatus = 'demo_fallback';
        processedActivities = createFallbackActivities(user.id).slice(0, 2); // Only 2 demo activities
      }
    }

    if (processedActivities.length > 0) {
      // Insert activities into database
      console.log(`Inserting ${processedActivities.length} activities into database...`);
      await insertGarminActivities(supabase, processedActivities);
      
      // Verify insertion
      await verifyInsertedData(supabase, user.id);
    }

    // Get final activity count
    const { data: finalCount } = await supabase
      .from('garmin_activities')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id);

    const responseMessage = {
      success: true,
      syncStatus,
      processedCount: processedActivities.length,
      totalActivities: finalCount?.length || 0,
      message: getSyncMessage(syncStatus, processedActivities.length),
      lastError: lastError || null,
      recommendation: getRecommendation(syncStatus),
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

function getSyncMessage(status: string, count: number): string {
  switch (status) {
    case 'api_success':
      return `Successfully synced ${count} activities from Garmin Connect API`;
    case 'api_failed':
      return 'Garmin API sync failed, but webhook system is handling real-time data';
    case 'webhook_data_available':
      return 'Using existing webhook data. Manual sync not needed as webhooks are working';
    case 'demo_fallback':
      return `API unavailable - ${count} demo activities created for testing`;
    default:
      return 'Sync completed with unknown status';
  }
}

function getRecommendation(status: string): string {
  switch (status) {
    case 'api_success':
      return 'Manual sync successful. Data will continue to arrive automatically via webhooks.';
    case 'api_failed':
      return 'Focus on webhook system for real-time sync. Check Garmin Developer Console webhook configuration.';
    case 'webhook_data_available':
      return 'Webhook system is working correctly. New activities will appear automatically.';
    case 'demo_fallback':
      return 'Please check Garmin API credentials and webhook configuration. Reconnect if needed.';
    default:
      return 'Check system status and try again.';
  }
}
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { fetchGarminActivities, fetchGarminDailyHealth, fetchGarminUserMetrics, checkGarminPermissions } from './garmin-api.ts';
import { processGarminActivities, processDailyHealthData, processVo2MaxData, processUserMetricsData, createFallbackActivities, createFallbackDailyHealth } from './data-processor.ts';
import { insertGarminActivities, insertGarminDailyHealth, insertGarminVo2Max, verifyInsertedData, verifyVo2MaxInsertion } from './database-operations.ts';
import { ensureValidTokens } from './token-refresh.ts';

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
    
    // Add more detailed logging for debugging
    console.log('Function invocation details:', {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      userAgent: req.headers.get('user-agent'),
      contentType: req.headers.get('content-type'),
      hasAuthHeader: !!req.headers.get('authorization')
    });

    if (!supabaseUrl || !supabaseKey || !clientId || !clientSecret) {
      const missing = [];
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      if (!clientId) missing.push('GARMIN_CLIENT_ID');
      if (!clientSecret) missing.push('GARMIN_CLIENT_SECRET');
      
      const errorMessage = `Missing required environment variables: ${missing.join(', ')}`;
      console.error('❌ Environment error:', errorMessage);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          timestamp: new Date().toISOString(),
          functionName: 'garmin-sync'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    console.log('Authorization header check:', {
      hasAuthHeader: !!authHeader,
      authHeaderStart: authHeader ? authHeader.substring(0, 20) + '...' : null,
      authHeaderLength: authHeader?.length || 0
    });
    
    if (!authHeader) {
      const errorMessage = 'No authorization header provided';
      console.error('❌ Auth error:', errorMessage);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          timestamp: new Date().toISOString(),
          functionName: 'garmin-sync'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Verifying JWT token...');
    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('JWT verification failed:', {
        error: authError,
        hasUser: !!user,
        errorMessage: authError?.message,
        errorStatus: authError?.status
      });
      
      const errorMessage = 'Invalid or expired JWT token';
      console.error('❌ JWT Auth error:', errorMessage);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          authError: authError?.message,
          timestamp: new Date().toISOString(),
          functionName: 'garmin-sync'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('JWT verified successfully for user:', user.id);

    // Ensure valid tokens (with automatic refresh if needed)
    console.log('🔄 Ensuring valid Garmin tokens (with automatic refresh)...');
    const { accessToken, tokenSecret, error: tokenValidationError } = await ensureValidTokens(
      supabase,
      user.id,
      clientId,
      clientSecret
    );

    if (tokenValidationError || !accessToken || !tokenSecret) {
      console.error('Failed to get valid tokens:', tokenValidationError);
      if (tokenValidationError.includes('No refresh token available') || 
          tokenValidationError.includes('Token refresh failed')) {
        throw new Error('Tokens do Garmin expiraram e não puderam ser renovados automaticamente. Por favor, reconecte sua conta Garmin.');
      }
      throw new Error(`Erro de autenticação do Garmin: ${tokenValidationError || 'Tokens inválidos'}`);
    }

    console.log('✅ Valid Garmin tokens obtained successfully');

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
    console.log('🔐 Checking Garmin API permissions...');
    const { permissions, error: permissionsError } = await checkGarminPermissions(accessToken, tokenSecret, clientId, clientSecret);
    
    if (permissionsError) {
      console.warn('⚠️ Could not verify permissions:', permissionsError);
      console.log('Available permission scopes may be limited');
    } else {
      console.log('✅ Garmin permissions verified:', JSON.stringify(permissions, null, 2));
      
      // Check specifically for User Metrics permission
      const hasUserMetricsPermission = permissions && (
        permissions.includes?.('USER_METRICS') || 
        permissions.userMetrics === true ||
        permissions.includes?.('WELLNESS') ||
        permissions.wellness === true
      );
      
      if (!hasUserMetricsPermission) {
        console.warn('⚠️ User Metrics permission may not be available - VO2 Max sync might use fallback');
      }
    }
    
    // Try to fetch data from both APIs
    console.log('Attempting to fetch data from both Garmin APIs...');
    
    // Fetch activities from Activity API
    console.log('=== FETCHING ACTIVITIES ===');
    const { data: activitiesData, lastError: activitiesError } = await fetchGarminActivities(
      accessToken, tokenSecret, clientId, clientSecret
    );
    console.log('Activities API result:', {
      hasData: !!activitiesData,
      dataLength: activitiesData?.length || 0,
      error: activitiesError
    });
    
    // Fetch daily health data from Daily Health Stats API  
    console.log('=== FETCHING DAILY HEALTH ===');
    const { data: healthData, lastError: healthError } = await fetchGarminDailyHealth(
      accessToken, tokenSecret, clientId, clientSecret
    );
    console.log('Daily Health API result:', {
      hasData: !!healthData,
      dataLength: healthData?.length || 0,
      error: healthError
    });
    
    // Fetch user metrics data from User Metrics API (for VO2 Max) - NEW 90-DAY APPROACH
    console.log('=== FETCHING USER METRICS (VO2 MAX) - 90 DAY HISTORICAL ===');
    const { data: userMetricsData, lastError: userMetricsError } = await fetchGarminUserMetrics(
      accessToken, tokenSecret, clientId, clientSecret
    );
    console.log('User Metrics API result:', {
      hasData: !!userMetricsData,
      dataLength: userMetricsData?.length || 0,
      error: userMetricsError,
      sampleData: userMetricsData?.slice(0, 2).map((item, index) => 
        `Record ${index + 1}: ${JSON.stringify(item, null, 2)}`
      ).join('\n') || 'No data'
    });

    let processedActivities = [];
    let processedHealthData = [];
    let syncStatus = 'unknown';
    let lastError = null;
    
    // Process activities data
    console.log('=== PROCESSING ACTIVITIES DATA ===');
    if (activitiesData && Array.isArray(activitiesData) && activitiesData.length > 0) {
      console.log(`Processing ${activitiesData.length} real activities from Activity API`);
      console.log('Sample activity data:', JSON.stringify(activitiesData[0], null, 2));
      processedActivities = processGarminActivities(activitiesData, user.id);
      console.log(`Processed ${processedActivities.length} activities successfully`);
      syncStatus = 'activity_api_success';
    } else {
      console.log('Activities API failed or returned no data:', {
        hasData: !!activitiesData,
        isArray: Array.isArray(activitiesData),
        length: activitiesData?.length,
        error: activitiesError
      });
      if (activitiesError) {
        lastError = activitiesError;
        console.log('Activity API error details:', activitiesError);
      }
    }
    
    // Process daily health data
    console.log('=== PROCESSING DAILY HEALTH DATA ===');
    let processedVo2MaxData = [];
    if (healthData && Array.isArray(healthData) && healthData.length > 0) {
      console.log(`Processing ${healthData.length} daily health records from Daily Health Stats API`);
      console.log('Sample health data:', JSON.stringify(healthData[0], null, 2));
      processedHealthData = processDailyHealthData(healthData, user.id);      
      console.log(`Processed ${processedHealthData.length} health records successfully`);
      if (syncStatus === 'activity_api_success') {
        syncStatus = 'both_apis_success';
      } else {
        syncStatus = 'health_api_success';
      }
    } else {
      console.log('Daily Health API failed or returned no data:', {
        hasData: !!healthData,
        isArray: Array.isArray(healthData),
        length: healthData?.length,
        error: healthError
      });
      if (healthError) {
        lastError = lastError || healthError;
        console.log('Daily Health API error details:', healthError);
      }
    }
    
    // Process user metrics data (primary source for VO2 Max)
    console.log('=== PROCESSING USER METRICS DATA (VO2 MAX) ===');
    if (userMetricsData && Array.isArray(userMetricsData) && userMetricsData.length > 0) {
      console.log(`✅ Got User Metrics data: ${userMetricsData.length} records`);
      console.log('🔍 DEBUGGING: Full User Metrics raw data:', JSON.stringify(userMetricsData, null, 2));
      
      // Log each record individually for debugging
      userMetricsData.forEach((record, index) => {
        console.log(`📊 User Metrics Record ${index + 1}:`, JSON.stringify(record, null, 2));
        console.log(`📊 Available keys in record ${index + 1}:`, Object.keys(record || {}));
        
        // Check for numeric values that might be VO2 Max
        const numericValues = Object.entries(record || {})
          .filter(([key, value]) => typeof value === 'number' && value > 0 && value < 100)
          .map(([key, value]) => `${key}: ${value}`);
        console.log(`🔢 Numeric values (0-100) in record ${index + 1}:`, numericValues);
      });
      
      processedVo2MaxData = processUserMetricsData(userMetricsData, user.id);
      console.log(`🎯 Processed VO2 Max data result:`, {
        found: processedVo2MaxData.length,
        data: processedVo2MaxData
      });
      
      if (processedVo2MaxData.length > 0) {
        console.log('✅ Sample processed VO2 Max data:', JSON.stringify(processedVo2MaxData[0], null, 2));
        syncStatus = 'usermetrics_vo2max_success';
      } else {
        console.log('❌ No VO2 Max extracted from User Metrics data');
        // Log all available fields in the data for debugging
        const allFields = new Set();
        userMetricsData.forEach(record => {
          Object.keys(record || {}).forEach(key => allFields.add(key));
        });
        console.log('🔍 All available fields in User Metrics data:', Array.from(allFields));
      }
    } else {
      console.log('❌ User Metrics API failed or returned no data:', {
        hasData: !!userMetricsData,
        isArray: Array.isArray(userMetricsData),
        length: userMetricsData?.length,
        error: userMetricsError,
        rawData: userMetricsData
      });
      
      if (userMetricsError) {
        lastError = lastError || userMetricsError;
        console.log('User Metrics API error details:', userMetricsError);
      }
    }
    
    // If no VO2 Max found in User Metrics, try fallback from Daily Health
    if (processedVo2MaxData.length === 0 && healthData && Array.isArray(healthData) && healthData.length > 0) {
      console.log('🔄 === FALLBACK: PROCESSING VO2 MAX FROM DAILY HEALTH DATA ===');
      console.log('🔍 DEBUGGING: Full Daily Health raw data:', JSON.stringify(healthData, null, 2));
      
      const fallbackVo2MaxData = processVo2MaxData(healthData, user.id);
      console.log(`🎯 Fallback VO2 Max result:`, {
        found: fallbackVo2MaxData.length,
        data: fallbackVo2MaxData
      });
      
      if (fallbackVo2MaxData && fallbackVo2MaxData.length > 0) {
        console.log(`✅ Found ${fallbackVo2MaxData.length} VO2 Max records from Daily Health fallback`);
        processedVo2MaxData = fallbackVo2MaxData;
        syncStatus = 'health_vo2max_fallback_success';
      } else {
        console.log('❌ No VO2 Max found in Daily Health fallback either');
      }
    }
    
    // If all APIs failed, check for existing data or create fallback
    if (processedActivities.length === 0 && processedHealthData.length === 0 && processedVo2MaxData.length === 0) {
      console.log('=== BOTH APIS FAILED - FALLBACK LOGIC ===');
      console.log('Both APIs failed, checking for existing data...');
      syncStatus = 'apis_failed';
      console.log('Final errors:', { activitiesError, healthError });
      
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
    let insertedVo2MaxRecords = 0;
    
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
    
    if (processedVo2MaxData.length > 0) {
      console.log(`🏃‍♂️ Inserting ${processedVo2MaxData.length} VO2 Max records into database...`);
      console.log('VO2 Max records to insert:', JSON.stringify(processedVo2MaxData, null, 2));
      const insertResult = await insertGarminVo2Max(supabase, processedVo2MaxData);
      insertedVo2MaxRecords = processedVo2MaxData.length;
      console.log(`✅ Successfully inserted ${insertedVo2MaxRecords} VO2 Max records`);
    } else {
      console.log('❌ No VO2 Max data to insert');
    }
    
    // Verify insertion
    if (insertedActivities > 0 || insertedHealthRecords > 0 || insertedVo2MaxRecords > 0) {
      await verifyInsertedData(supabase, user.id);
      
      // Additional detailed verification for VO2 Max data
      if (insertedVo2MaxRecords > 0) {
        await verifyVo2MaxInsertion(supabase, user.id);
      }
    }

    // Get final counts
    const [{ data: activityCount }, { data: healthCount }, { data: vo2MaxCount }] = await Promise.all([
      supabase.from('garmin_activities').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('garmin_daily_health').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('garmin_vo2_max').select('id', { count: 'exact' }).eq('user_id', user.id)
    ]);

    const responseMessage = {
      success: true,
      syncStatus,
      processedActivities: insertedActivities,
      processedHealthRecords: insertedHealthRecords,
      processedVo2MaxRecords: insertedVo2MaxRecords,
      totalActivities: activityCount?.length || 0,
      totalHealthRecords: healthCount?.length || 0,
      totalVo2MaxRecords: vo2MaxCount?.length || 0,
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
    case 'all_apis_success':
      return `Successfully synced ${activityCount} activities, ${healthCount} daily health records, and VO2 Max data from all Garmin APIs`;
    case 'both_apis_success':
      return `Successfully synced ${activityCount} activities and ${healthCount} daily health records from both Garmin APIs`;
    case 'activity_usermetrics_success':
      return `Successfully synced ${activityCount} activities and VO2 Max data from Garmin APIs`;
    case 'health_usermetrics_success':
      return `Successfully synced ${healthCount} daily health records and VO2 Max data from Garmin APIs`;
    case 'usermetrics_api_success':
      return `Successfully synced VO2 Max data from Garmin User Metrics API`;
    case 'activity_api_success':
      return `Successfully synced ${activityCount} activities from Garmin Activity API`;
    case 'health_api_success':
      return `Successfully synced ${healthCount} daily health records from Garmin Daily Health Stats API`;
    case 'apis_failed':
      return 'All Garmin APIs failed, but webhook system may be handling real-time data';
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
    case 'all_apis_success':
      return 'All APIs working perfectly! Activity, health, and VO2 Max data will continue via webhooks.';
    case 'both_apis_success':
      return 'Activity and health APIs working perfectly! Data will continue via webhooks.';
    case 'activity_usermetrics_success':
      return 'Activity and VO2 Max APIs working. Check Daily Health Stats API permissions if health data is needed.';
    case 'health_usermetrics_success':
      return 'Health and VO2 Max APIs working. Check Activity API permissions if activity data is needed.';
    case 'usermetrics_api_success':
      return 'VO2 Max API working perfectly! Check other API permissions if activity/health data is needed.';
    case 'activity_api_success':
      return 'Activity API working. Check Daily Health Stats and User Metrics API permissions if health/VO2 Max data is needed.';
    case 'health_api_success':
      return 'Daily Health Stats API working. Check Activity and User Metrics API permissions if activity/VO2 Max data is needed.';
    case 'apis_failed':
      return 'Check Garmin API credentials and permissions for Activity, Daily Health Stats, and User Metrics APIs.';
    case 'webhook_data_available':
      return 'Webhook system working correctly. New data will appear automatically.';
    case 'demo_fallback':
      return 'Reconnect Garmin account and verify API permissions in Garmin Developer Console.';
    default:
      return 'Check system status and try again.';
  }
}
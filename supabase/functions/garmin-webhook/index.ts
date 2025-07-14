import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Enhanced logging for webhook requests
    console.log('=== Garmin Webhook Request ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    const url = new URL(req.url);
    console.log('Query Params:', Object.fromEntries(url.searchParams.entries()));
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    console.log('Content-Type:', req.headers.get('content-type'));
    console.log('User-Agent:', req.headers.get('user-agent'));
    console.log('Timestamp:', new Date().toISOString());

    if (req.method === 'POST') {
      let webhookData;
      try {
        webhookData = await req.json();
      } catch (error) {
        console.error('Failed to parse webhook JSON:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON in webhook payload' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('=== Webhook Data Received ===');
      console.log('Raw webhook data:', JSON.stringify(webhookData, null, 2));
      console.log('Webhook data keys:', Object.keys(webhookData));
      console.log('Webhook data type analysis:', {
        hasActivities: !!webhookData.activities,
        hasDeregistrations: !!webhookData.deregistrations,
        hasUserId: !!webhookData.userId,
        hasCallbackURL: !!webhookData.callbackURL,
        activityCount: webhookData.activities?.length || 0,
        webhookFormat: webhookData.activities ? 'PUSH_FORMAT' : 
                      (webhookData.userId && webhookData.callbackURL) ? 'PING_FORMAT' : 'UNKNOWN'
      });

      // Process webhook notifications using callbackURL pattern
      let processResult = { success: false, message: 'Unknown webhook type' };

      // Handle activity notifications with callbackURL
      if (webhookData.activities && Array.isArray(webhookData.activities)) {
        console.log(`Processing ${webhookData.activities.length} activity notifications`);
        let successCount = 0;
        let totalProcessed = 0;
        
        for (const activityNotification of webhookData.activities) {
          const userId = activityNotification.userId;
          const callbackURL = activityNotification.callbackURL;
          
          console.log("Processing activity notification:", { userId, callbackURL });
          
          if (userId && callbackURL) {
            const result = await processActivityCallbackURL(supabase, userId, callbackURL);
            if (result.success) successCount++;
            totalProcessed++;
          }
        }
        
        processResult = { 
          success: successCount > 0, 
          message: `Processed ${successCount}/${totalProcessed} activity notifications successfully` 
        };
      }
      // Handle user disconnection
      else if (webhookData.deregistrations && Array.isArray(webhookData.deregistrations)) {
        console.log('Processing user disconnection');
        const result = await processUserDisconnection(supabase, webhookData.deregistrations[0]);
        processResult = result;
      }
      // Handle single notification (fallback)
      else if (webhookData.userId && webhookData.callbackURL) {
        console.log('Processing single activity notification');
        processResult = await processActivityCallbackURL(supabase, webhookData.userId, webhookData.callbackURL);
      }
      else {
        console.log('Unknown webhook format, logging for analysis:', Object.keys(webhookData));
        processResult = { success: true, message: 'Webhook logged for analysis' };
      }

      console.log('=== Webhook Processing Complete ===');
      console.log('Result:', processResult);

      // Respond with 200 within 30 seconds as required by Garmin
      return new Response(JSON.stringify({ 
        success: processResult.success,
        message: processResult.message,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle GET requests for webhook verification
    if (req.method === 'GET') {
      console.log('Webhook verification request received');
      return new Response(JSON.stringify({
        status: 'active',
        endpoint: 'Garmin webhook endpoint OAuth 2.0',
        timestamp: new Date().toISOString(),
        version: '3.0'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Method not allowed',
      allowedMethods: ['GET', 'POST'],
      timestamp: new Date().toISOString()
    }), { 
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== Webhook Error ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Process activity notification by fetching data from callbackURL
async function processActivityCallbackURL(supabase: any, userId: string, callbackURL: string) {
  console.log('=== Processing Activity CallbackURL ===');
  console.log('User ID:', userId);
  console.log('Callback URL:', callbackURL);

  try {
    // Enhanced user mapping - try multiple strategies to find the user
    console.log('=== Enhanced User Mapping ===');
    let tokenData = null;
    
    // Strategy 1: Search by consumer_key (most likely for Garmin)
    console.log('Strategy 1: Searching by consumer_key =', userId);
    const { data: tokenByConsumerKey } = await supabase
      .from('garmin_tokens')
      .select('user_id, access_token, consumer_key, oauth_verifier')
      .eq('consumer_key', userId)
      .maybeSingle();
      
    if (tokenByConsumerKey) {
      console.log('Found user by consumer_key:', tokenByConsumerKey.user_id);
      tokenData = tokenByConsumerKey;
    }
    
    // Strategy 2: Search by oauth_verifier if not found
    if (!tokenData) {
      console.log('Strategy 2: Searching by oauth_verifier =', userId);
      const { data: tokenByVerifier } = await supabase
        .from('garmin_tokens')
        .select('user_id, access_token, consumer_key, oauth_verifier')
        .eq('oauth_verifier', userId)
        .maybeSingle();
        
      if (tokenByVerifier) {
        console.log('Found user by oauth_verifier:', tokenByVerifier.user_id);
        tokenData = tokenByVerifier;
      }
    }
    
    // Strategy 3: Try to find user by callbackURL pattern (if it contains identifiable info)
    if (!tokenData && callbackURL) {
      console.log('Strategy 3: Analyzing callbackURL for user identification');
      console.log('CallbackURL:', callbackURL);
      
      // Extract potential user identifier from URL
      const urlMatch = callbackURL.match(/userId[=\/]([^&\/]+)/i);
      if (urlMatch) {
        const urlUserId = urlMatch[1];
        console.log('Found userId in URL:', urlUserId);
        
        const { data: tokenByUrlUserId } = await supabase
          .from('garmin_tokens')
          .select('user_id, access_token, consumer_key, oauth_verifier')
          .or(`consumer_key.eq.${urlUserId},oauth_verifier.eq.${urlUserId}`)
          .maybeSingle();
          
        if (tokenByUrlUserId) {
          console.log('Found user by URL userId:', tokenByUrlUserId.user_id);
          tokenData = tokenByUrlUserId;
        }
      }
    }
    
    // Strategy 4: If still not found, get all tokens for manual analysis
    if (!tokenData) {
      console.log('Strategy 4: Getting all available tokens for analysis');
      const { data: allTokens } = await supabase
        .from('garmin_tokens')
        .select('user_id, access_token, consumer_key, oauth_verifier, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log('Available tokens for debugging:', allTokens?.map(t => ({
        user_id: t.user_id,
        consumer_key: t.consumer_key,
        oauth_verifier: t.oauth_verifier,
        created_at: t.created_at
      })));
      
      // For debugging: try the most recent token if we only have one user
      if (allTokens && allTokens.length === 1) {
        console.log('Only one token found, using it for debugging purposes');
        tokenData = allTokens[0];
      }
    }

    if (!tokenData) {
      console.error('=== USER MAPPING FAILED ===');
      console.error('Searched for userId:', userId);
      console.error('CallbackURL:', callbackURL);
      await logWebhookCall(supabase, 'ACTIVITY_CALLBACK', null, false, 0, `User not found for userId: ${userId}`);
      return { success: false, message: `User not found for userId: ${userId}` };
    }

    const dbUserId = tokenData.user_id;
    const accessToken = tokenData.access_token;

    console.log('Found user:', dbUserId);
    console.log('Fetching activity data from callbackURL...');

    // Fetch activity data from callbackURL using Bearer token
    const callbackResponse = await fetch(callbackURL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!callbackResponse.ok) {
      const errorText = await callbackResponse.text();
      console.error('Failed to fetch from callbackURL:', callbackResponse.status, errorText);
      await logWebhookCall(supabase, 'ACTIVITY_CALLBACK', dbUserId, false, 0, `CallbackURL fetch failed: ${callbackResponse.status}`);
      return { success: false, message: `Failed to fetch activity data: ${callbackResponse.status}` };
    }

    const activitiesData = await callbackResponse.json();
    console.log('Activity data received:', { 
      count: Array.isArray(activitiesData) ? activitiesData.length : 'not array',
      sample: Array.isArray(activitiesData) && activitiesData.length > 0 ? Object.keys(activitiesData[0]) : 'N/A'
    });

    if (!Array.isArray(activitiesData)) {
      console.error('Expected array of activities, got:', typeof activitiesData);
      await logWebhookCall(supabase, 'ACTIVITY_CALLBACK', dbUserId, false, 0, 'Invalid activity data format');
      return { success: false, message: 'Invalid activity data format' };
    }

    let processedCount = 0;
    let duplicateCount = 0;

    // Process each activity
    for (const activity of activitiesData) {
      try {
        const activityId = activity.summaryId || activity.activityId || activity.id;
        if (!activityId) {
          console.warn('Activity missing ID, skipping:', activity);
          continue;
        }

        // Check if this activity already exists
        const { data: existingActivity } = await supabase
          .from('garmin_activities')
          .select('id')
          .eq('user_id', dbUserId)
          .eq('garmin_activity_id', parseInt(activityId.toString()))
          .maybeSingle();

        if (existingActivity) {
          console.log('Duplicate activity detected, skipping:', activityId);
          duplicateCount++;
          continue;
        }

        // Convert Garmin data format to our schema
        const processed = {
          user_id: dbUserId,
          garmin_activity_id: parseInt(activityId.toString()),
          name: activity.activityName || activity.name || activity.activityType || `Activity ${activityId}`,
          type: (activity.activityType || 'unknown').toLowerCase(),
          start_date: activity.startTimeLocal || activity.startTime || activity.startTimeInSeconds 
            ? new Date(activity.startTimeInSeconds * 1000).toISOString() 
            : new Date().toISOString(),
          distance: activity.distanceInMeters ? activity.distanceInMeters : null,
          moving_time: activity.durationInSeconds || null,
          elapsed_time: activity.durationInSeconds || null,
          average_speed: activity.averageSpeedInMetersPerSecond ? activity.averageSpeedInMetersPerSecond : null,
          max_speed: activity.maxSpeedInMetersPerSecond ? activity.maxSpeedInMetersPerSecond : null,
          average_heartrate: activity.averageHeartRateInBeatsPerMinute ? parseInt(activity.averageHeartRateInBeatsPerMinute) : null,
          max_heartrate: activity.maxHeartRateInBeatsPerMinute ? parseInt(activity.maxHeartRateInBeatsPerMinute) : null,
          calories: activity.activeKilocalories ? parseInt(activity.activeKilocalories) : null,
          total_elevation_gain: activity.elevationGainInMeters ? activity.elevationGainInMeters : null,
        };

        console.log('Processing activity:', {
          id: processed.garmin_activity_id,
          name: processed.name,
          type: processed.type,
          date: processed.start_date
        });

        // Insert activity
        const { error: insertError } = await supabase
          .from('garmin_activities')
          .insert(processed);

        if (insertError) {
          console.error('Database insert error:', insertError);
        } else {
          console.log('Successfully processed activity:', processed.garmin_activity_id);
          processedCount++;
        }

      } catch (activityError) {
        console.error('Error processing individual activity:', activityError);
      }
    }

    console.log(`Finished processing activities. Processed: ${processedCount}, Duplicates: ${duplicateCount}, Total: ${activitiesData.length}`);

    // Update backfill status if applicable
    await updateBackfillStatus(supabase, dbUserId, processedCount);

    // Log webhook stats
    await logWebhookCall(supabase, 'ACTIVITY_CALLBACK', dbUserId, true, processedCount, null);

    return { 
      success: true, 
      message: `Successfully processed ${processedCount} activities from callback (${duplicateCount} duplicates skipped)`,
      activitiesProcessed: processedCount
    };

  } catch (error) {
    console.error('Error processing activity callback:', error);
    await logWebhookCall(supabase, 'ACTIVITY_CALLBACK', null, false, 0, error.message);
    return { success: false, message: `Activity callback processing error: ${error.message}` };
  }
}

// Function to log webhook calls for monitoring
async function logWebhookCall(
  supabase: any, 
  webhookType: string, 
  userId: string | null, 
  success: boolean, 
  activitiesProcessed: number, 
  errorMessage: string | null
) {
  try {
    await supabase
      .from('webhook_stats')
      .insert({
        webhook_type: webhookType,
        user_id: userId,
        success,
        activities_processed: activitiesProcessed,
        error_message: errorMessage
      });
  } catch (error) {
    console.error('Error logging webhook call:', error);
  }
}

async function updateBackfillStatus(supabase: any, userId: string, activitiesProcessed: number) {
  try {
    console.log(`[updateBackfillStatus] Checking backfills for user ${userId}, activities: ${activitiesProcessed}`);
    
    // Find pending or in_progress backfills for this user
    const { data: backfillRecords } = await supabase
      .from('garmin_backfill_status')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .order('requested_at', { ascending: true });

    if (!backfillRecords || backfillRecords.length === 0) {
      console.log('[updateBackfillStatus] No active backfills found');
      return;
    }

    console.log(`[updateBackfillStatus] Found ${backfillRecords.length} active backfills`);

    const now = new Date();

    for (const backfill of backfillRecords) {
      console.log(`[updateBackfillStatus] Processing backfill ${backfill.id} (${backfill.status})`);
      
      // Count actual activities within this backfill period
      const { data: activitiesInPeriod, error: countError } = await supabase
        .from('garmin_activities')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .gte('start_date', backfill.period_start)
        .lte('start_date', backfill.period_end);

      if (countError) {
        console.error('[updateBackfillStatus] Error counting activities:', countError);
        continue;
      }

      const actualActivitiesCount = activitiesInPeriod?.length || 0;
      console.log(`[updateBackfillStatus] Found ${actualActivitiesCount} activities in backfill period`);

      // If backfill is pending, mark as in_progress immediately when we receive webhook data
      if (backfill.status === 'pending') {
        console.log(`[updateBackfillStatus] Marking backfill ${backfill.id} as in_progress (received webhook data)`);
        
        const { error: updateError } = await supabase
          .from('garmin_backfill_status')
          .update({
            status: 'in_progress',
            activities_processed: actualActivitiesCount,
            updated_at: now.toISOString()
          })
          .eq('id', backfill.id);

        if (updateError) {
          console.error('[updateBackfillStatus] Error updating to in_progress:', updateError);
        }
      }

      // For in_progress backfills, mark as completed immediately when we receive webhook data
      // This indicates Garmin has finished sending data for this period
      if (backfill.status === 'in_progress' || backfill.status === 'pending') {
        console.log(`[updateBackfillStatus] Marking backfill ${backfill.id} as completed (received webhook data)`);
        
        const { error: completeError } = await supabase
          .from('garmin_backfill_status')
          .update({
            status: 'completed',
            completed_at: now.toISOString(),
            activities_processed: actualActivitiesCount,
            updated_at: now.toISOString()
          })
          .eq('id', backfill.id);

        if (completeError) {
          console.error('[updateBackfillStatus] Error marking as completed:', completeError);
        } else {
          console.log(`[updateBackfillStatus] Successfully completed backfill ${backfill.id} with ${actualActivitiesCount} activities`);
        }
      }
    }
  } catch (error) {
    console.error('[updateBackfillStatus] Error:', error);
  }
}

async function processUserDisconnection(supabase: any, data: any) {
  console.log('=== Processing User Disconnection ===');
  console.log('Disconnection data:', data);

  try {
    const userId = data.userId || data.externalUserId || data.garminUserId;
    
    if (!userId) {
      console.error('No user ID found in disconnection data');
      return { success: false, message: 'No user ID found in disconnection data' };
    }

    // Delete user's Garmin tokens
    const { error: deleteError } = await supabase
      .from('garmin_tokens')
      .delete()
      .or(`consumer_key.eq.${userId},oauth_verifier.eq.${userId}`);

    if (deleteError) {
      console.error('Error deleting user tokens:', deleteError);
      return { success: false, message: 'Failed to disconnect user' };
    }

    console.log('Successfully disconnected user:', userId);
    return { success: true, message: 'User disconnected successfully' };

  } catch (error) {
    console.error('Error processing user disconnection:', error);
    return { success: false, message: `Disconnection error: ${error.message}` };
  }
}
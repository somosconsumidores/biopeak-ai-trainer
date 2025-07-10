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
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
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

      // Validate webhook data structure
      if (!webhookData || typeof webhookData !== 'object') {
        console.error('Invalid webhook data structure');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid webhook data structure' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Process different types of webhook notifications - support multiple notifications
      let processResult = { success: false, message: 'Unknown webhook type' };

      // Handle multiple notifications in a single webhook call
      const notifications = webhookData.activityDetails || webhookData.activity || webhookData.deregistrations || [webhookData];
      
      if (Array.isArray(notifications)) {
        console.log(`Processing ${notifications.length} notifications in webhook`);
        let successCount = 0;
        let totalProcessed = 0;
        
        for (const item of notifications) {
          const userId = item.userId || item.externalUserId || item.garminUserId;
          console.log("Processing notification:", { userId, summaryType: item.summaryType });
          
          if (item.summaryType && item.userAccessToken) {
            const result = await processGarminNotification(supabase, item);
            if (result.success) successCount++;
            totalProcessed++;
          } else if (item.userAccessToken && item.summaryType === 'USER_DISCONNECTED') {
            const result = await processUserDisconnection(supabase, item);
            if (result.success) successCount++;
            totalProcessed++;
          }
        }
        
        processResult = { 
          success: successCount > 0, 
          message: `Processed ${successCount}/${totalProcessed} notifications successfully` 
        };
      } else {
        // Single notification (original logic)
        if (webhookData.summaryType && webhookData.userAccessToken) {
          console.log('Processing webhook with summaryType:', webhookData.summaryType);
          processResult = await processGarminNotification(supabase, webhookData);
        } else if (webhookData.userAccessToken && webhookData.summaryType === 'USER_DISCONNECTED') {
          console.log('Processing user disconnection');
          processResult = await processUserDisconnection(supabase, webhookData);
        } else {
          console.log('Unknown webhook format, logging for analysis:', Object.keys(webhookData));
          processResult = { success: true, message: 'Webhook logged for analysis' };
        }
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
        endpoint: 'Garmin webhook endpoint',
        timestamp: new Date().toISOString(),
        version: '2.0'
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

async function processGarminNotification(supabase: any, data: any) {
  console.log('=== Processing Garmin Notification ===');
  console.log('Summary Type:', data.summaryType);
  console.log('User Access Token:', data.userAccessToken ? 'Present' : 'Missing');

  try {
    // Find user by access token with improved error handling
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('user_id, access_token')
      .eq('access_token', data.userAccessToken)
      .maybeSingle();

    if (tokenError) {
      console.error('Database error finding user token:', tokenError);
      return { success: false, message: 'Database error finding user' };
    }

    if (!tokenData) {
      console.error('User not found for access token:', data.userAccessToken?.substring(0, 10) + '...');
      // List all available tokens for debugging (without exposing full tokens)
      const { data: allTokens } = await supabase
        .from('garmin_tokens')
        .select('user_id, access_token')
        .limit(5);
      
      console.log('Available tokens in database:', allTokens?.map(t => ({
        user_id: t.user_id,
        token_preview: t.access_token?.substring(0, 10) + '...'
      })));
      
      return { success: false, message: 'User not found for provided token' };
    }

    const userId = tokenData.user_id;
    console.log('Found user:', userId);

    // Process based on summary type with enhanced error handling
    let result;
    switch (data.summaryType) {
      case 'ACTIVITY':
        result = await processActivityNotification(supabase, userId, data);
        break;
      case 'DAILY_SUMMARY':
        result = await processDailySummaryNotification(supabase, userId, data);
        break;
      case 'SLEEP':
        result = await processSleepNotification(supabase, userId, data);
        break;
      default:
        console.log('Unknown summary type, logging for future implementation:', data.summaryType);
        result = { success: true, message: `Logged unknown summary type: ${data.summaryType}` };
    }

    return result;
  } catch (error) {
    console.error('Error processing Garmin notification:', error);
    return { success: false, message: `Processing error: ${error.message}` };
  }
}

async function processActivityNotification(supabase: any, userId: string, data: any) {
  console.log('=== Processing Activity Notification ===');
  console.log('User ID:', userId);
  console.log('Activities in webhook:', data.activities?.length || 0);

  try {
    // Validate activity data structure
    const activities = data.activities || [];
    if (!Array.isArray(activities)) {
      console.error('Activities is not an array:', typeof activities);
      return { success: false, message: 'Invalid activities data structure' };
    }

    if (activities.length === 0) {
      console.log('No activities in webhook notification');
      return { success: true, message: 'No activities to process' };
    }

    console.log('Processing', activities.length, 'activities');

    let processedCount = 0;
    let duplicateCount = 0;

    // Process activities individually for better duplicate control
    for (const activity of activities) {
      try {
        const activityId = activity.activityId || activity.id || activity.activityUuid;
        if (!activityId) {
          console.warn('Activity missing ID, skipping:', activity);
          continue;
        }

        // Check if this activity already exists (duplicate control)
        const { data: existingActivity } = await supabase
          .from('garmin_activities')
          .select('id')
          .eq('user_id', userId)
          .eq('garmin_activity_id', parseInt(activityId.toString()))
          .maybeSingle();

        if (existingActivity) {
          console.log('Duplicate activity detected, skipping:', activityId);
          duplicateCount++;
          continue;
        }

        const processed = {
          user_id: userId,
          garmin_activity_id: parseInt(activityId.toString()),
          name: activity.activityName || activity.name || activity.activityType?.typeKey || `Webhook Activity`,
          type: (activity.activityType?.typeKey || activity.activityType || activity.type || 'unknown').toLowerCase(),
          start_date: activity.startTimeLocal || activity.startTime || activity.beginTimestamp || new Date().toISOString(),
          distance: activity.distance ? Math.round(parseFloat(activity.distance) * 1000) : null,
          moving_time: activity.movingDuration || activity.duration || activity.elapsedDuration || null,
          elapsed_time: activity.elapsedDuration || activity.duration || activity.movingDuration || null,
          average_speed: activity.averageSpeed ? parseFloat(activity.averageSpeed) : null,
          max_speed: activity.maxSpeed ? parseFloat(activity.maxSpeed) : null,
          average_heartrate: activity.averageHR ? parseInt(activity.averageHR) : (activity.avgHR ? parseInt(activity.avgHR) : null),
          max_heartrate: activity.maxHR ? parseInt(activity.maxHR) : null,
          calories: activity.calories ? parseInt(activity.calories) : null,
          total_elevation_gain: activity.elevationGain ? parseFloat(activity.elevationGain) : null,
        };

        console.log('Processing activity:', {
          id: processed.garmin_activity_id,
          name: processed.name,
          type: processed.type
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
        console.error('Error processing individual activity:', activityError, activity);
      }
    }

    console.log(`Finished processing activities. Processed: ${processedCount}, Duplicates: ${duplicateCount}, Total: ${activities.length}`);

    // Clean up any remaining demo activities
    const { error: cleanupError } = await supabase
      .from('garmin_activities')
      .delete()
      .eq('user_id', userId)
      .like('name', '%Demo%');

    if (cleanupError) {
      console.warn('Failed to cleanup demo activities:', cleanupError);
    }

    // Check if this might be from a backfill and update backfill status
    await updateBackfillStatus(supabase, userId, processedCount);

    return { 
      success: true, 
      message: `Successfully processed ${processedCount} activities from webhook (${duplicateCount} duplicates skipped)` 
    };

  } catch (error) {
    console.error('Error processing activity notification:', error);
    return { success: false, message: `Activity processing error: ${error.message}` };
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

    // Log webhook call for monitoring
    console.log(`[updateBackfillStatus] Webhook called at ${new Date().toISOString()} for user ${userId}`);

    if (!backfillRecords || backfillRecords.length === 0) {
      console.log('[updateBackfillStatus] No active backfills found');
      return;
    }

    console.log(`[updateBackfillStatus] Found ${backfillRecords.length} active backfills`);

    // Get the current timestamp for comparison
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

      // If backfill is pending and we have activities, mark as in_progress
      if (backfill.status === 'pending' && actualActivitiesCount > 0) {
        console.log(`[updateBackfillStatus] Marking backfill ${backfill.id} as in_progress`);
        
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
      // If backfill is in_progress, update the activities count
      else if (backfill.status === 'in_progress') {
        console.log(`[updateBackfillStatus] Updating activities count for backfill ${backfill.id}`);
        
        const { error: updateError } = await supabase
          .from('garmin_backfill_status')
          .update({
            activities_processed: actualActivitiesCount,
            updated_at: now.toISOString()
          })
          .eq('id', backfill.id);

        if (updateError) {
          console.error('[updateBackfillStatus] Error updating activities count:', updateError);
        }

        // Check if backfill has been in_progress for more than 1 hour (might be complete)
        const requestedAt = new Date(backfill.requested_at);
        const hoursSinceRequest = (now.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceRequest > 1 && actualActivitiesCount > 0) {
          console.log(`[updateBackfillStatus] Backfill ${backfill.id} has been in progress for ${hoursSinceRequest.toFixed(1)} hours, considering completion`);
          
          // Mark as completed if it's been a while and we have activities
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
            console.log(`[updateBackfillStatus] Marked backfill ${backfill.id} as completed with ${actualActivitiesCount} activities`);
          }
        }
      }
    }
  } catch (error) {
    console.error('[updateBackfillStatus] Error in updateBackfillStatus:', error);
  }
}

async function processDailySummaryNotification(supabase: any, userId: string, data: any) {
  console.log('=== Processing Daily Summary Notification ===');
  console.log('User ID:', userId);
  console.log('Daily summary data:', JSON.stringify(data, null, 2));
  
  // For now, just log the data for future implementation
  // This would involve creating a health_summaries table and processing the data
  return { success: true, message: 'Daily summary logged for future implementation' };
}

async function processSleepNotification(supabase: any, userId: string, data: any) {
  console.log('=== Processing Sleep Notification ===');
  console.log('User ID:', userId);
  console.log('Sleep data:', JSON.stringify(data, null, 2));
  
  // For now, just log the data for future implementation
  // This would involve creating a sleep_data table and processing the data
  return { success: true, message: 'Sleep data logged for future implementation' };
}

async function processUserDisconnection(supabase: any, data: any) {
  console.log('=== Processing User Disconnection ===');
  console.log('User access token:', data.userAccessToken?.substring(0, 10) + '...');

  try {
    // Remove user tokens when they disconnect
    const { data: deletedData, error } = await supabase
      .from('garmin_tokens')
      .delete()
      .eq('access_token', data.userAccessToken)
      .select();

    if (error) {
      console.error('Error removing disconnected user tokens:', error);
      return { success: false, message: `Error removing tokens: ${error.message}` };
    }

    if (deletedData && deletedData.length > 0) {
      console.log('Successfully removed tokens for disconnected user:', deletedData[0].user_id);
      return { success: true, message: 'User disconnection processed successfully' };
    } else {
      console.log('No tokens found to remove for disconnected user');
      return { success: true, message: 'No tokens found for disconnected user' };
    }

  } catch (error) {
    console.error('Error processing user disconnection:', error);
    return { success: false, message: `Disconnection processing error: ${error.message}` };
  }
}
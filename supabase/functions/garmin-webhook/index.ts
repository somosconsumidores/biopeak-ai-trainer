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

      // Process different types of webhook notifications
      let processResult = { success: false, message: 'Unknown webhook type' };

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

    // Transform and validate Garmin activity data
    const processedActivities = activities.map((activity: any, index: number) => {
      const activityId = activity.activityId || activity.id || activity.activityUuid;
      if (!activityId) {
        console.warn(`Activity ${index} missing ID, using timestamp fallback`);
      }

      const processed = {
        user_id: userId,
        garmin_activity_id: activityId ? parseInt(activityId.toString()) : (Date.now() + index),
        name: activity.activityName || activity.name || activity.activityType?.typeKey || `Webhook Activity ${index + 1}`,
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

      console.log(`Processed activity ${index + 1}:`, {
        id: processed.garmin_activity_id,
        name: processed.name,
        type: processed.type,
        distance: processed.distance,
        duration: processed.moving_time
      });

      return processed;
    }).filter(activity => activity.garmin_activity_id); // Remove activities without valid IDs

    if (processedActivities.length === 0) {
      console.error('No valid activities after processing');
      return { success: false, message: 'No valid activities found in webhook data' };
    }

    console.log(`Inserting ${processedActivities.length} activities into database...`);

    // Insert activities with conflict resolution
    const { data: insertedData, error: insertError } = await supabase
      .from('garmin_activities')
      .upsert(processedActivities, { 
        onConflict: 'user_id,garmin_activity_id',
        ignoreDuplicates: false 
      })
      .select();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return { success: false, message: `Database error: ${insertError.message}` };
    }

    console.log(`Successfully processed ${processedActivities.length} activities`);
    console.log('Inserted data preview:', insertedData?.slice(0, 2));

    // Clean up any remaining demo activities
    const { error: cleanupError } = await supabase
      .from('garmin_activities')
      .delete()
      .eq('user_id', userId)
      .like('name', '%Demo%');

    if (cleanupError) {
      console.warn('Failed to cleanup demo activities:', cleanupError);
    }

    return { 
      success: true, 
      message: `Successfully processed ${processedActivities.length} activities from webhook` 
    };

  } catch (error) {
    console.error('Error processing activity notification:', error);
    return { success: false, message: `Activity processing error: ${error.message}` };
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
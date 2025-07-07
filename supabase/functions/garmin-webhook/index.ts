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

    // Log the webhook request for debugging
    console.log('Garmin webhook received:', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    });

    if (req.method === 'POST') {
      const webhookData = await req.json();
      console.log('Webhook data received:', JSON.stringify(webhookData, null, 2));

      // Process different types of webhook notifications
      if (webhookData.summaryType) {
        await processGarminNotification(supabase, webhookData);
      } else if (webhookData.userAccessToken && webhookData.summaryType === 'USER_DISCONNECTED') {
        await processUserDisconnection(supabase, webhookData);
      }

      // Respond with 200 within 30 seconds as required by Garmin
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle GET requests for webhook verification
    if (req.method === 'GET') {
      return new Response('Garmin webhook endpoint active', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processGarminNotification(supabase: any, data: any) {
  console.log('Processing Garmin notification:', data);

  // Find user by access token
  const { data: tokenData, error: tokenError } = await supabase
    .from('garmin_tokens')
    .select('user_id')
    .eq('access_token', data.userAccessToken)
    .single();

  if (tokenError || !tokenData) {
    console.error('User not found for access token:', data.userAccessToken);
    throw new Error('User not found');
  }

  const userId = tokenData.user_id;

  // Process based on summary type
  switch (data.summaryType) {
    case 'ACTIVITY':
      await processActivityNotification(supabase, userId, data);
      break;
    case 'DAILY_SUMMARY':
      await processDailySummaryNotification(supabase, userId, data);
      break;
    case 'SLEEP':
      await processSleepNotification(supabase, userId, data);
      break;
    default:
      console.log('Unknown summary type:', data.summaryType);
  }
}

async function processActivityNotification(supabase: any, userId: string, data: any) {
  console.log('Processing activity notification for user:', userId);

  // Transform Garmin activity data to our format
  const activities = data.activities || [];
  const processedActivities = activities.map((activity: any) => ({
    user_id: userId,
    garmin_activity_id: parseInt(activity.activityId || activity.id),
    name: activity.activityName || activity.name || 'Garmin Activity',
    type: (activity.activityType?.typeKey || activity.type || 'unknown').toLowerCase(),
    start_date: activity.startTimeLocal || activity.startTime || new Date().toISOString(),
    distance: activity.distance ? Math.round(parseFloat(activity.distance) * 1000) : null,
    moving_time: activity.movingDuration || activity.duration || null,
    elapsed_time: activity.elapsedDuration || activity.duration || null,
    average_speed: parseFloat(activity.averageSpeed) || null,
    max_speed: parseFloat(activity.maxSpeed) || null,
    average_heartrate: parseInt(activity.averageHR) || null,
    max_heartrate: parseInt(activity.maxHR) || null,
    calories: parseInt(activity.calories) || null,
    total_elevation_gain: parseFloat(activity.elevationGain) || null,
  }));

  if (processedActivities.length > 0) {
    const { error } = await supabase
      .from('garmin_activities')
      .upsert(processedActivities, { 
        onConflict: 'user_id,garmin_activity_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Error inserting activities:', error);
    } else {
      console.log(`Successfully processed ${processedActivities.length} activities`);
    }
  }
}

async function processDailySummaryNotification(supabase: any, userId: string, data: any) {
  console.log('Processing daily summary notification for user:', userId);
  // Implementation for daily summary data
  // This would involve creating a health_summaries table and processing the data
}

async function processSleepNotification(supabase: any, userId: string, data: any) {
  console.log('Processing sleep notification for user:', userId);
  // Implementation for sleep data
  // This would involve creating a sleep_data table and processing the data
}

async function processUserDisconnection(supabase: any, data: any) {
  console.log('Processing user disconnection:', data);

  // Remove user tokens when they disconnect
  const { error } = await supabase
    .from('garmin_tokens')
    .delete()
    .eq('access_token', data.userAccessToken);

  if (error) {
    console.error('Error removing disconnected user tokens:', error);
  } else {
    console.log('Successfully removed tokens for disconnected user');
  }
}
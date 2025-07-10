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
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('=== Manual Backfill Processor ===');

    if (req.method === 'POST') {
      const { operation } = await req.json();
      let result;

      if (operation === 'process-pending') {
        result = await processPendingBackfills(supabase);
      } else if (operation === 'force-callback') {
        result = await forceCallbackTest(supabase);
      } else {
        result = { success: false, message: 'Invalid operation' };
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      message: 'Manual Backfill Processor',
      availableOperations: ['process-pending', 'force-callback']
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processPendingBackfills(supabase: any) {
  console.log('Processing pending backfills...');
  
  try {
    // Get all pending backfills
    const { data: pendingBackfills, error: fetchError } = await supabase
      .from('garmin_backfill_status')
      .select(`
        id,
        user_id,
        period_start,
        period_end,
        requested_at,
        status
      `)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching pending backfills:', fetchError);
      return { success: false, message: 'Failed to fetch pending backfills' };
    }

    if (!pendingBackfills || pendingBackfills.length === 0) {
      return { success: true, message: 'No pending backfills found' };
    }

    console.log(`Found ${pendingBackfills.length} pending backfills`);
    const results = [];

    for (const backfill of pendingBackfills) {
      console.log(`Processing backfill ${backfill.id} for user ${backfill.user_id}`);
      
      // Get user tokens
      const { data: userToken } = await supabase
        .from('garmin_tokens')
        .select('access_token, consumer_key, oauth_verifier')
        .eq('user_id', backfill.user_id)
        .maybeSingle();

      if (!userToken) {
        console.log(`No tokens found for user ${backfill.user_id}`);
        results.push({
          backfillId: backfill.id,
          success: false,
          message: 'User tokens not found'
        });
        continue;
      }

      // Create synthetic callbackURL for the backfill period
      const startTime = Math.floor(new Date(backfill.period_start).getTime() / 1000);
      const endTime = Math.floor(new Date(backfill.period_end).getTime() / 1000);
      const callbackURL = `https://apis.garmin.com/wellness-api/rest/backfill/activities?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`;

      console.log(`Testing callbackURL for backfill ${backfill.id}:`, callbackURL);

      // Test the callback URL manually
      try {
        const response = await fetch(callbackURL, {
          headers: {
            'Authorization': `Bearer ${userToken.access_token}`,
            'Accept': 'application/json'
          }
        });

        console.log(`Callback response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Callback failed:`, response.status, errorText);
          
          // Update backfill status to error
          await supabase
            .from('garmin_backfill_status')
            .update({
              status: 'error',
              error_message: `Callback failed: ${response.status} - ${errorText}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', backfill.id);

          results.push({
            backfillId: backfill.id,
            success: false,
            message: `Callback failed: ${response.status}`
          });
          continue;
        }

        const activitiesData = await response.json();
        console.log(`Received ${Array.isArray(activitiesData) ? activitiesData.length : 'non-array'} activities`);

        if (!Array.isArray(activitiesData)) {
          results.push({
            backfillId: backfill.id,
            success: false,
            message: 'Invalid activity data format'
          });
          continue;
        }

        // Process activities (similar to webhook processing)
        let processedCount = 0;
        for (const activity of activitiesData) {
          try {
            const activityId = activity.summaryId || activity.activityId || activity.id;
            if (!activityId) continue;

            // Check if activity already exists
            const { data: existingActivity } = await supabase
              .from('garmin_activities')
              .select('id')
              .eq('user_id', backfill.user_id)
              .eq('garmin_activity_id', parseInt(activityId.toString()))
              .maybeSingle();

            if (existingActivity) continue; // Skip duplicates

            // Insert new activity
            const processed = {
              user_id: backfill.user_id,
              garmin_activity_id: parseInt(activityId.toString()),
              name: activity.activityName || activity.name || activity.activityType || `Activity ${activityId}`,
              type: (activity.activityType || 'unknown').toLowerCase(),
              start_date: activity.startTimeLocal || activity.startTime || activity.startTimeInSeconds 
                ? new Date(activity.startTimeInSeconds * 1000).toISOString() 
                : new Date().toISOString(),
              distance: activity.distanceInMeters || null,
              moving_time: activity.durationInSeconds || null,
              elapsed_time: activity.durationInSeconds || null,
              average_speed: activity.averageSpeedInMetersPerSecond || null,
              max_speed: activity.maxSpeedInMetersPerSecond || null,
              average_heartrate: activity.averageHeartRateInBeatsPerMinute ? parseInt(activity.averageHeartRateInBeatsPerMinute) : null,
              max_heartrate: activity.maxHeartRateInBeatsPerMinute ? parseInt(activity.maxHeartRateInBeatsPerMinute) : null,
              calories: activity.activeKilocalories ? parseInt(activity.activeKilocalories) : null,
              total_elevation_gain: activity.elevationGainInMeters || null,
            };

            const { error: insertError } = await supabase
              .from('garmin_activities')
              .insert(processed);

            if (!insertError) {
              processedCount++;
            }
          } catch (activityError) {
            console.error('Error processing activity:', activityError);
          }
        }

        // Update backfill status
        await supabase
          .from('garmin_backfill_status')
          .update({
            status: processedCount > 0 ? 'completed' : 'error',
            activities_processed: processedCount,
            completed_at: new Date().toISOString(),
            error_message: processedCount === 0 ? 'No activities processed' : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', backfill.id);

        results.push({
          backfillId: backfill.id,
          success: processedCount > 0,
          message: `Processed ${processedCount} activities`,
          activitiesProcessed: processedCount
        });

      } catch (callbackError) {
        console.error(`Error testing callback for backfill ${backfill.id}:`, callbackError);
        
        await supabase
          .from('garmin_backfill_status')
          .update({
            status: 'error',
            error_message: callbackError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', backfill.id);

        results.push({
          backfillId: backfill.id,
          success: false,
          message: `Callback error: ${callbackError.message}`
        });
      }
    }

    return {
      success: true,
      message: `Processed ${pendingBackfills.length} pending backfills`,
      results: results
    };

  } catch (error) {
    console.error('Error processing pending backfills:', error);
    return { success: false, message: error.message };
  }
}

async function forceCallbackTest(supabase: any) {
  console.log('Testing callback URLs manually...');
  
  try {
    // Get all users with tokens
    const { data: userTokens } = await supabase
      .from('garmin_tokens')
      .select('user_id, access_token, consumer_key, oauth_verifier, created_at');

    if (!userTokens || userTokens.length === 0) {
      return { success: false, message: 'No user tokens found' };
    }

    const results = [];
    
    for (const token of userTokens) {
      console.log(`Testing callback for user ${token.user_id}`);
      
      // Test with different time ranges
      const now = new Date();
      const sixMonthsAgo = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));
      
      const startTime = Math.floor(sixMonthsAgo.getTime() / 1000);
      const endTime = Math.floor(now.getTime() / 1000);
      
      const testCallbackURL = `https://apis.garmin.com/wellness-api/rest/backfill/activities?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`;
      
      try {
        console.log(`Testing URL: ${testCallbackURL}`);
        
        const response = await fetch(testCallbackURL, {
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Accept': 'application/json'
          }
        });

        const resultData = {
          userId: token.user_id,
          tokenAge: new Date().getTime() - new Date(token.created_at).getTime(),
          callbackURL: testCallbackURL,
          responseStatus: response.status,
          responseHeaders: Object.fromEntries(response.headers.entries()),
          success: response.ok
        };

        if (response.ok) {
          try {
            const data = await response.json();
            resultData.dataReceived = {
              type: Array.isArray(data) ? 'array' : typeof data,
              count: Array.isArray(data) ? data.length : 'N/A',
              sample: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : 'N/A'
            };
          } catch (jsonError) {
            resultData.dataReceived = { error: 'Failed to parse JSON response' };
          }
        } else {
          const errorText = await response.text();
          resultData.errorMessage = errorText;
        }

        results.push(resultData);
        
      } catch (fetchError) {
        results.push({
          userId: token.user_id,
          callbackURL: testCallbackURL,
          success: false,
          error: fetchError.message
        });
      }
    }

    return {
      success: true,
      message: `Tested callback URLs for ${userTokens.length} users`,
      results: results
    };

  } catch (error) {
    console.error('Error in force callback test:', error);
    return { success: false, message: error.message };
  }
}
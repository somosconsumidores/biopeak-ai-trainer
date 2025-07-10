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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Backfill Cleanup] Starting cleanup process...');
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    
    // Find stuck backfills (pending > 1 hour or in_progress > 6 hours)
    const { data: stuckBackfills, error: stuckError } = await supabase
      .from('garmin_backfill_status')
      .select('*')
      .or(`and(status.eq.pending,requested_at.lt.${oneHourAgo.toISOString()}),and(status.eq.in_progress,requested_at.lt.${sixHoursAgo.toISOString()})`);

    if (stuckError) {
      console.error('[Backfill Cleanup] Error finding stuck backfills:', stuckError);
      throw stuckError;
    }

    console.log(`[Backfill Cleanup] Found ${stuckBackfills?.length || 0} stuck backfills`);

    let retriedCount = 0;
    let timeoutCount = 0;

    for (const backfill of stuckBackfills || []) {
      console.log(`[Backfill Cleanup] Processing stuck backfill ${backfill.id} (status: ${backfill.status})`);
      
      // Check if there are any activities in this period
      const { data: activitiesInPeriod } = await supabase
        .from('garmin_activities')
        .select('id', { count: 'exact' })
        .eq('user_id', backfill.user_id)
        .gte('start_date', backfill.period_start)
        .lte('start_date', backfill.period_end);

      const activityCount = activitiesInPeriod?.length || 0;
      
      if (activityCount > 0) {
        // Mark as completed if we have activities
        console.log(`[Backfill Cleanup] Marking backfill ${backfill.id} as completed with ${activityCount} activities`);
        
        await supabase
          .from('garmin_backfill_status')
          .update({
            status: 'completed',
            completed_at: now.toISOString(),
            activities_processed: activityCount,
            updated_at: now.toISOString()
          })
          .eq('id', backfill.id);
          
        retriedCount++;
      } else {
        // Check if this backfill has been retried before
        const hoursStuck = (now.getTime() - new Date(backfill.requested_at).getTime()) / (1000 * 60 * 60);
        
        if (hoursStuck > 24) {
          // Mark as error if stuck for more than 24 hours
          console.log(`[Backfill Cleanup] Marking backfill ${backfill.id} as timeout (${hoursStuck.toFixed(1)} hours stuck)`);
          
          await supabase
            .from('garmin_backfill_status')
            .update({
              status: 'error',
              error_message: `Timeout: No activities received after ${hoursStuck.toFixed(1)} hours`,
              updated_at: now.toISOString()
            })
            .eq('id', backfill.id);
            
          timeoutCount++;
        } else {
          // Retry the backfill by calling the API again
          console.log(`[Backfill Cleanup] Retrying backfill ${backfill.id}`);
          
          try {
            // Get user's tokens
            const { data: tokenData } = await supabase
              .from('garmin_tokens')
              .select('access_token, token_secret')
              .eq('user_id', backfill.user_id)
              .maybeSingle();

            if (tokenData) {
              // Retry the Garmin API call
              const clientId = Deno.env.get('GARMIN_CLIENT_ID')!;
              const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET')!;
              
              const backfillUrl = 'https://apis.garmin.com/wellness-api/rest/backfill/activities';
              const summaryStartTimeInSeconds = Math.floor(new Date(backfill.period_start).getTime() / 1000);
              const summaryEndTimeInSeconds = Math.floor(new Date(backfill.period_end).getTime() / 1000);
              
              const fullUrl = `${backfillUrl}?summaryStartTimeInSeconds=${summaryStartTimeInSeconds}&summaryEndTimeInSeconds=${summaryEndTimeInSeconds}`;
              
              // Generate OAuth 1.0 signature (reusing logic from garmin-backfill)
              const oauth = {
                oauth_consumer_key: clientId,
                oauth_token: tokenData.access_token,
                oauth_signature_method: 'HMAC-SHA1',
                oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
                oauth_nonce: Math.random().toString(36).substring(2, 15),
                oauth_version: '1.0'
              };
              
              const params = new URLSearchParams({
                summaryStartTimeInSeconds: summaryStartTimeInSeconds.toString(),
                summaryEndTimeInSeconds: summaryEndTimeInSeconds.toString(),
                ...oauth
              });
              
              const sortedParams = Array.from(params.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');
              
              const baseString = `GET&${encodeURIComponent(backfillUrl)}&${encodeURIComponent(sortedParams)}`;
              const signingKey = `${encodeURIComponent(clientSecret)}&${encodeURIComponent(tokenData.token_secret)}`;
              
              const encoder = new TextEncoder();
              const signingKeyData = encoder.encode(signingKey);
              const baseStringData = encoder.encode(baseString);
              
              const cryptoKey = await crypto.subtle.importKey(
                'raw',
                signingKeyData,
                { name: 'HMAC', hash: 'SHA-1' },
                false,
                ['sign']
              );
              
              const signature = await crypto.subtle.sign('HMAC', cryptoKey, baseStringData);
              const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
              
              oauth.oauth_signature = signatureBase64;
              
              const authHeader = 'OAuth ' + Object.entries(oauth)
                .map(([key, value]) => `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`)
                .join(', ');

              const response = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                  'Authorization': authHeader,
                  'Accept': 'application/json'
                }
              });

              if (response.status === 202) {
                console.log(`[Backfill Cleanup] Retry successful for backfill ${backfill.id}`);
                
                await supabase
                  .from('garmin_backfill_status')
                  .update({
                    status: 'in_progress',
                    updated_at: now.toISOString(),
                    error_message: null
                  })
                  .eq('id', backfill.id);
                  
                retriedCount++;
              } else {
                console.log(`[Backfill Cleanup] Retry failed for backfill ${backfill.id}: ${response.status}`);
              }
            }
          } catch (retryError) {
            console.error(`[Backfill Cleanup] Error retrying backfill ${backfill.id}:`, retryError);
          }
        }
      }
    }

    console.log(`[Backfill Cleanup] Cleanup completed: ${retriedCount} retried, ${timeoutCount} timed out`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleanup completed: ${retriedCount} backfills retried, ${timeoutCount} timed out`,
        processed: stuckBackfills?.length || 0,
        retried: retriedCount,
        timedOut: timeoutCount
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[Backfill Cleanup] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
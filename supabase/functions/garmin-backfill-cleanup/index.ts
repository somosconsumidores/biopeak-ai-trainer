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
    
    // Find stuck backfills that need retry
    const { data: stuckBackfills, error: stuckError } = await supabase
      .from('garmin_backfill_status')
      .select('*')
      .or(
        `and(status.eq.pending,requested_at.lt.${oneHourAgo.toISOString()}),` +
        `and(status.eq.in_progress,requested_at.lt.${sixHoursAgo.toISOString()}),` +
        `and(status.eq.error,retry_count.lt.max_retries,next_retry_at.lt.${now.toISOString()})`
      );

    if (stuckError) {
      console.error('[Backfill Cleanup] Error finding stuck backfills:', stuckError);
      throw stuckError;
    }

    console.log(`[Backfill Cleanup] Found ${stuckBackfills?.length || 0} stuck backfills`);

    let retriedCount = 0;
    let timeoutCount = 0;

    for (const backfill of stuckBackfills || []) {
      console.log(`[Backfill Cleanup] Processing backfill ${backfill.id} (status: ${backfill.status}, type: ${backfill.summary_type})`);
      
      // Check if we should retry this backfill
      if (backfill.retry_count >= backfill.max_retries) {
        console.log(`[Backfill Cleanup] Max retries reached for backfill ${backfill.id}`);
        timeoutCount++;
        continue;
      }

      // For completed error status, check if we need to retry
      if (backfill.status === 'error' && backfill.next_retry_at && new Date(backfill.next_retry_at) > now) {
        console.log(`[Backfill Cleanup] Backfill ${backfill.id} not ready for retry yet`);
        continue;
      }

      // Check if there's relevant data for this summary type and period
      let dataExists = false;
      let dataCount = 0;

      if (backfill.summary_type === 'dailies') {
        const { data: healthData } = await supabase
          .from('garmin_daily_health')
          .select('id', { count: 'exact' })
          .eq('user_id', backfill.user_id)
          .gte('summary_date', backfill.period_start.split('T')[0])
          .lte('summary_date', backfill.period_end.split('T')[0]);
        dataCount = healthData?.length || 0;
        dataExists = dataCount > 0;
      } else if (backfill.summary_type === 'userMetrics') {
        const { data: vo2Data } = await supabase
          .from('garmin_vo2_max')
          .select('id', { count: 'exact' })
          .eq('user_id', backfill.user_id)
          .gte('measurement_date', backfill.period_start.split('T')[0])
          .lte('measurement_date', backfill.period_end.split('T')[0]);
        dataCount = vo2Data?.length || 0;
        dataExists = dataCount > 0;
      }
      // Add more data checks for other summary types as needed

      if (dataExists) {
        // Mark as completed if we have data
        console.log(`[Backfill Cleanup] Marking backfill ${backfill.id} as completed with ${dataCount} records`);
        
        await supabase
          .from('garmin_backfill_status')
          .update({
            status: 'completed',
            completed_at: now.toISOString(),
            activities_processed: dataCount,
            updated_at: now.toISOString()
          })
          .eq('id', backfill.id);
          
        retriedCount++;
      } else {
        // Retry the backfill by calling the updated garmin-backfill function
        console.log(`[Backfill Cleanup] Retrying backfill ${backfill.id} (attempt ${backfill.retry_count + 1}/${backfill.max_retries})`);
        
        try {
          // Calculate next retry time using the database function
          const nextRetryTime = await supabase.rpc('calculate_next_retry', {
            retry_count: backfill.retry_count
          });

          // Update retry information
          await supabase
            .from('garmin_backfill_status')
            .update({
              retry_count: backfill.retry_count + 1,
              next_retry_at: nextRetryTime.data,
              updated_at: now.toISOString()
            })
            .eq('id', backfill.id);

          // Call the garmin-backfill function to retry
          const { error: retryError } = await supabase.functions.invoke('garmin-backfill', {
            body: {
              periodStart: backfill.period_start,
              periodEnd: backfill.period_end,
              summaryTypes: [backfill.summary_type]
            }
          });

          if (!retryError) {
            console.log(`[Backfill Cleanup] Retry initiated for backfill ${backfill.id}`);
            retriedCount++;
          } else {
            console.error(`[Backfill Cleanup] Error retrying backfill ${backfill.id}:`, retryError);
            
            // Mark as error if we've hit max retries
            if (backfill.retry_count + 1 >= backfill.max_retries) {
              await supabase
                .from('garmin_backfill_status')
                .update({
                  status: 'error',
                  error_message: `Max retries reached: ${retryError.message || 'Unknown error'}`,
                  updated_at: now.toISOString()
                })
                .eq('id', backfill.id);
              timeoutCount++;
            }
          }
        } catch (retryError) {
          console.error(`[Backfill Cleanup] Error during retry process for backfill ${backfill.id}:`, retryError);
          
          // Update error count and potentially mark as failed
          await supabase
            .from('garmin_backfill_status')
            .update({
              retry_count: backfill.retry_count + 1,
              error_message: `Retry error: ${retryError.message}`,
              updated_at: now.toISOString()
            })
            .eq('id', backfill.id);
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
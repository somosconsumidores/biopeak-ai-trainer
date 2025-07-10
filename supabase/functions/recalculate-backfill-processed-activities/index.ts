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

    console.log('=== Recalculate Backfill Processed Activities ===');
    console.log('Timestamp:', new Date().toISOString());

    if (req.method === 'POST') {
      const result = await recalculateBackfillActivities(supabase);
      
      return new Response(JSON.stringify({ 
        success: result.success,
        message: result.message,
        details: result.details,
        timestamp: new Date().toISOString()
      }), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Method not allowed. Use POST to trigger recalculation.',
      timestamp: new Date().toISOString()
    }), { 
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== Recalculate Function Error ===');
    console.error('Error details:', error);
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

async function recalculateBackfillActivities(supabase: any) {
  try {
    console.log('[recalculateBackfillActivities] Starting recalculation process');
    
    // Get all backfills that are not completed
    const { data: activeBackfills, error: fetchError } = await supabase
      .from('garmin_backfill_status')
      .select('*')
      .in('status', ['pending', 'in_progress'])
      .order('requested_at', { ascending: true });

    if (fetchError) {
      console.error('[recalculateBackfillActivities] Error fetching backfills:', fetchError);
      return { success: false, message: 'Error fetching active backfills' };
    }

    if (!activeBackfills || activeBackfills.length === 0) {
      console.log('[recalculateBackfillActivities] No active backfills found');
      return { 
        success: true, 
        message: 'No active backfills to process',
        details: { processed: 0, completed: 0, errors: 0 }
      };
    }

    console.log(`[recalculateBackfillActivities] Found ${activeBackfills.length} active backfills`);

    const now = new Date();
    const results = {
      processed: 0,
      completed: 0,
      errors: 0,
      details: []
    };

    for (const backfill of activeBackfills) {
      try {
        console.log(`[recalculateBackfillActivities] Processing backfill ${backfill.id} for user ${backfill.user_id}`);
        
        // Count actual activities within this backfill period
        const { data: activitiesInPeriod, error: countError } = await supabase
          .from('garmin_activities')
          .select('id', { count: 'exact' })
          .eq('user_id', backfill.user_id)
          .gte('start_date', backfill.period_start)
          .lte('start_date', backfill.period_end);

        if (countError) {
          console.error(`[recalculateBackfillActivities] Error counting activities for backfill ${backfill.id}:`, countError);
          results.errors++;
          results.details.push({
            backfill_id: backfill.id,
            user_id: backfill.user_id,
            status: 'error',
            error: countError.message
          });
          continue;
        }

        const actualActivitiesCount = activitiesInPeriod?.length || 0;
        console.log(`[recalculateBackfillActivities] Found ${actualActivitiesCount} activities for backfill ${backfill.id}`);

        // Calculate time since request
        const requestedAt = new Date(backfill.requested_at);
        const hoursSinceRequest = (now.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);

        let newStatus = backfill.status;
        let completed_at = backfill.completed_at;

        // Determine new status based on activities and time
        if (backfill.status === 'pending' && actualActivitiesCount > 0) {
          newStatus = 'in_progress';
          console.log(`[recalculateBackfillActivities] Marking backfill ${backfill.id} as in_progress`);
        } else if (backfill.status === 'in_progress' && hoursSinceRequest > 24) {
          // Mark as completed if it's been more than 24 hours since request
          newStatus = 'completed';
          completed_at = now.toISOString();
          results.completed++;
          console.log(`[recalculateBackfillActivities] Marking backfill ${backfill.id} as completed (24+ hours old)`);
        } else if (backfill.status === 'in_progress' && hoursSinceRequest > 2 && actualActivitiesCount > 0) {
          // If we have activities and it's been a reasonable time, consider it complete
          newStatus = 'completed';
          completed_at = now.toISOString();
          results.completed++;
          console.log(`[recalculateBackfillActivities] Marking backfill ${backfill.id} as completed (${hoursSinceRequest.toFixed(1)} hours, ${actualActivitiesCount} activities)`);
        }

        // Update the backfill record
        const updateData: any = {
          activities_processed: actualActivitiesCount,
          updated_at: now.toISOString()
        };

        if (newStatus !== backfill.status) {
          updateData.status = newStatus;
          if (completed_at && completed_at !== backfill.completed_at) {
            updateData.completed_at = completed_at;
          }
        }

        const { error: updateError } = await supabase
          .from('garmin_backfill_status')
          .update(updateData)
          .eq('id', backfill.id);

        if (updateError) {
          console.error(`[recalculateBackfillActivities] Error updating backfill ${backfill.id}:`, updateError);
          results.errors++;
          results.details.push({
            backfill_id: backfill.id,
            user_id: backfill.user_id,
            status: 'error',
            error: updateError.message
          });
        } else {
          results.processed++;
          results.details.push({
            backfill_id: backfill.id,
            user_id: backfill.user_id,
            old_status: backfill.status,
            new_status: newStatus,
            old_activities: backfill.activities_processed || 0,
            new_activities: actualActivitiesCount,
            hours_since_request: Math.round(hoursSinceRequest * 10) / 10
          });
          console.log(`[recalculateBackfillActivities] Successfully updated backfill ${backfill.id}: ${backfill.status} → ${newStatus}, activities: ${actualActivitiesCount}`);
        }

      } catch (backfillError) {
        console.error(`[recalculateBackfillActivities] Error processing backfill ${backfill.id}:`, backfillError);
        results.errors++;
        results.details.push({
          backfill_id: backfill.id,
          user_id: backfill.user_id,
          status: 'error',
          error: backfillError.message
        });
      }
    }

    const message = `Recalculation complete: ${results.processed} processed, ${results.completed} completed, ${results.errors} errors`;
    console.log(`[recalculateBackfillActivities] ${message}`);

    return {
      success: true,
      message,
      details: results
    };

  } catch (error) {
    console.error('[recalculateBackfillActivities] Error in recalculation process:', error);
    return {
      success: false,
      message: `Recalculation error: ${error.message}`
    };
  }
}
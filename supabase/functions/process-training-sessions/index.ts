import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to calculate performance score based on activity data
function calculatePerformanceScore(activity: any): number {
  if (!activity.average_speed || !activity.distance) return 50;
  
  // Basic performance calculation (can be enhanced later)
  const speedKmh = activity.average_speed * 3.6;
  const distanceKm = activity.distance / 1000;
  
  // Simple scoring based on pace for running activities
  if (activity.type === 'Run') {
    const paceMinPerKm = 60 / speedKmh;
    if (paceMinPerKm < 4) return 95;
    if (paceMinPerKm < 4.5) return 88;
    if (paceMinPerKm < 5) return 82;
    if (paceMinPerKm < 5.5) return 75;
    if (paceMinPerKm < 6) return 68;
    return 60;
  }
  
  // For other activities, use a simpler metric
  return Math.min(95, Math.max(50, speedKmh * 5));
}

// Calculate average pace in seconds per km for running activities
function calculateAveragePace(distance: number, duration: number): number | null {
  if (!distance || !duration) return null;
  const distanceKm = distance / 1000;
  return duration / distanceKm; // seconds per km
}

// Generate mock heart rate zones data
function generateZonesData(averageHr: number | null): any {
  if (!averageHr) return null;
  
  return {
    zone1: Math.round(Math.random() * 15 + 5), // 5-20%
    zone2: Math.round(Math.random() * 25 + 15), // 15-40%
    zone3: Math.round(Math.random() * 30 + 20), // 20-50%
    zone4: Math.round(Math.random() * 20 + 10), // 10-30%
    zone5: Math.round(Math.random() * 10 + 2), // 2-12%
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[process-training-sessions] Starting processing for user:', user.id)

    // Get user's Strava activities that haven't been processed yet
    const { data: activities, error: activitiesError } = await supabaseClient
      .from('strava_activities')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })
      .limit(20)

    if (activitiesError) {
      console.error('[process-training-sessions] Error fetching activities:', activitiesError)
      return new Response(JSON.stringify({ error: 'Failed to fetch activities' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!activities || activities.length === 0) {
      console.log('[process-training-sessions] No activities found for user:', user.id)
      return new Response(JSON.stringify({ 
        message: 'No activities to process',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get existing training sessions to avoid duplicates
    const { data: existingSessions, error: sessionsError } = await supabaseClient
      .from('training_sessions')
      .select('strava_activity_id')
      .eq('user_id', user.id)
      .not('strava_activity_id', 'is', null)

    if (sessionsError) {
      console.error('[process-training-sessions] Error fetching existing sessions:', sessionsError)
      return new Response(JSON.stringify({ error: 'Failed to fetch existing sessions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Filter out activities that have already been processed
    const processedActivityIds = new Set(existingSessions?.map(s => s.strava_activity_id) || [])
    const unprocessedActivities = activities.filter(activity => 
      !processedActivityIds.has(activity.strava_activity_id)
    )

    console.log(`[process-training-sessions] Found ${activities.length} total activities, ${unprocessedActivities.length} unprocessed`)

    if (unprocessedActivities.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No new activities to process',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let processedCount = 0

    // Process each activity into a training session
    for (const activity of unprocessedActivities) {
      const performanceScore = calculatePerformanceScore(activity)
      const averagePace = calculateAveragePace(activity.distance, activity.moving_time)
      const zonesData = generateZonesData(activity.average_heartrate)
      
      // Generate mock recovery metrics
      const recoveryMetrics = {
        estimated_recovery_time: Math.round((activity.moving_time / 3600) * 12 + Math.random() * 8), // hours
        stress_score: Math.round(performanceScore * 0.8 + Math.random() * 20),
        hydration_status: ['Ótima', 'Boa', 'Moderada'][Math.floor(Math.random() * 3)],
        muscle_fatigue: ['Baixa', 'Moderada', 'Alta'][Math.floor(Math.random() * 3)]
      }

      const { error: insertError } = await supabaseClient
        .from('training_sessions')
        .insert({
          user_id: user.id,
          strava_activity_id: activity.strava_activity_id,
          name: activity.name,
          activity_type: activity.type,
          start_date: activity.start_date,
          duration: activity.moving_time || activity.elapsed_time,
          distance: activity.distance,
          average_pace: averagePace,
          average_speed: activity.average_speed,
          average_heartrate: activity.average_heartrate,
          max_heartrate: activity.max_heartrate,
          calories: activity.calories,
          elevation_gain: activity.total_elevation_gain,
          performance_score: performanceScore,
          zones_data: zonesData,
          recovery_metrics: recoveryMetrics
        })

      if (insertError) {
        console.error('Error inserting training session:', insertError)
      } else {
        processedCount++
      }
    }

    console.log(`[process-training-sessions] Successfully processed ${processedCount}/${activities.length} training sessions for user:`, user.id)

    return new Response(JSON.stringify({ 
      success: true,
      processed: processedCount,
      total: unprocessedActivities.length,
      skipped: activities.length - unprocessedActivities.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in process-training-sessions function:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
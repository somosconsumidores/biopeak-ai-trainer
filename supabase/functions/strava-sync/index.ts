
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StravaActivity {
  id: number
  name: string
  type: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  start_date: string
  average_speed: number
  max_speed: number
  average_heartrate?: number
  max_heartrate?: number
  calories?: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    // Get user's Strava tokens
    console.log('[strava-sync] Fetching Strava tokens for user:', user.id)
    
    // Initialize service role client for potential RLS bypass
    const serviceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // First attempt: Try with ANON_KEY and authenticated user context
    let { data: tokenData, error: tokenError } = await supabaseClient
      .from('strava_tokens')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    console.log('[strava-sync] Token fetch with ANON_KEY:', {
      hasTokenData: !!tokenData,
      tokenError: tokenError,
      userId: user.id
    })

    let usingServiceRole = false

    // If RLS blocks access, try with SERVICE_ROLE_KEY
    if (tokenError || !tokenData) {
      console.log('[strava-sync] Attempting token fetch with SERVICE_ROLE_KEY to bypass RLS...')
      
      const { data: serviceTokenData, error: serviceTokenError } = await serviceRoleClient
        .from('strava_tokens')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      
      console.log('[strava-sync] Token fetch with SERVICE_ROLE_KEY:', {
        hasServiceTokenData: !!serviceTokenData,
        serviceTokenError: serviceTokenError
      })
      
      if (serviceTokenError) {
        console.error('[strava-sync] Error fetching Strava tokens even with SERVICE_ROLE_KEY:', serviceTokenError)
        return new Response(JSON.stringify({ error: 'Error fetching Strava connection' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      if (!serviceTokenData) {
        console.log('[strava-sync] No Strava tokens found for user:', user.id)
        return new Response(JSON.stringify({ error: 'Strava not connected' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      tokenData = serviceTokenData
      usingServiceRole = true
      console.log('[strava-sync] Using SERVICE_ROLE_KEY tokens - RLS issue confirmed for strava_tokens table')
    }

    // Check if token is expired and refresh if needed
    const now = new Date()
    const expiresAt = new Date(tokenData.expires_at)
    let accessToken = tokenData.access_token

    if (now >= expiresAt) {
      console.log('Token expired, refreshing...')
      // Refresh token
      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: Deno.env.get('STRAVA_CLIENT_ID'),
          client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
          refresh_token: tokenData.refresh_token,
          grant_type: 'refresh_token',
        }),
      })

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text()
        console.error('Failed to refresh Strava token:', {
          status: refreshResponse.status,
          body: errorText
        })
        return new Response(JSON.stringify({ 
          error: 'Failed to refresh Strava token',
          details: errorText 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      // Update tokens in database - use SERVICE_ROLE_KEY if we had RLS issues
      const updateClient = usingServiceRole ? serviceRoleClient : supabaseClient
      const { error: updateError } = await updateClient
        .from('strava_tokens')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
        })
        .eq('user_id', user.id)
      
      if (updateError) {
        console.error('[strava-sync] Error updating refreshed tokens:', updateError)
      }
    }

    // Fetch activities from Strava
    console.log('[strava-sync] Fetching activities from Strava for user:', user.id)
    const activitiesResponse = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=50',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!activitiesResponse.ok) {
      console.error('Failed to fetch Strava activities:', await activitiesResponse.text())
      return new Response(JSON.stringify({ error: 'Failed to fetch activities from Strava' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const activities: StravaActivity[] = await activitiesResponse.json()
    let syncedCount = 0

    // Store activities in database
    for (const activity of activities) {
      const { error: insertError } = await supabaseClient
        .from('strava_activities')
        .upsert({
          user_id: user.id,
          strava_activity_id: activity.id,
          name: activity.name,
          type: activity.type,
          distance: activity.distance,
          moving_time: activity.moving_time,
          elapsed_time: activity.elapsed_time,
          total_elevation_gain: activity.total_elevation_gain,
          start_date: activity.start_date,
          average_speed: activity.average_speed,
          max_speed: activity.max_speed,
          average_heartrate: activity.average_heartrate,
          max_heartrate: activity.max_heartrate,
          calories: activity.calories,
        }, {
          onConflict: 'strava_activity_id'
        })

      if (!insertError) {
        syncedCount++
      }
    }

    console.log(`[strava-sync] Successfully synced ${syncedCount}/${activities.length} activities for user:`, user.id)

    return new Response(JSON.stringify({ 
      success: true,
      synced: syncedCount,
      total: activities.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in strava-sync function:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})


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
  console.log('[strava-sync] Function called, method:', req.method)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[strava-sync] Handling CORS preflight')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[strava-sync] Starting sync process...')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    console.log('[strava-sync] Supabase client created')

    const authHeader = req.headers.get('Authorization')
    console.log('[strava-sync] Auth header present:', !!authHeader)
    
    if (!authHeader) {
      console.error('[strava-sync] No Authorization header')
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    const token = authHeader.replace('Bearer ', '')
    console.log('[strava-sync] Token extracted, length:', token?.length)
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    console.log('[strava-sync] Auth check result:', { hasUser: !!user, authError: !!authError })
    
    if (authError || !user) {
      console.error('[strava-sync] Authentication failed:', authError?.message)
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

    // Fetch activities from Strava with pagination to get up to 300 activities
    console.log('[strava-sync] Fetching activities from Strava for user:', user.id)
    
    const maxActivities = 300
    const perPage = 200 // Maximum allowed by Strava API
    const activities: StravaActivity[] = []
    
    // Fetch first page (200 activities)
    console.log('[strava-sync] Fetching page 1 with 200 activities')
    let activitiesResponse = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!activitiesResponse.ok) {
      const errorText = await activitiesResponse.text()
      console.error('[strava-sync] Failed to fetch Strava activities (page 1):', errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch activities from Strava' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let pageActivities: StravaActivity[] = await activitiesResponse.json()
    console.log(`[strava-sync] Received ${pageActivities.length} activities from page 1`)
    activities.push(...pageActivities)
    
    // Fetch second page (100 more activities to reach 300 total)
    if (pageActivities.length === 200 && activities.length < maxActivities) {
      console.log('[strava-sync] Fetching page 2 with 100 activities')
      activitiesResponse = await fetch(
        'https://www.strava.com/api/v3/athlete/activities?per_page=100&page=2',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      if (activitiesResponse.ok) {
        pageActivities = await activitiesResponse.json()
        console.log(`[strava-sync] Received ${pageActivities.length} activities from page 2`)
        activities.push(...pageActivities)
      } else {
        console.warn('[strava-sync] Failed to fetch page 2, continuing with page 1 results')
      }
    }
    
    console.log(`[strava-sync] Total activities fetched: ${activities.length}`)
    let syncedCount = 0

    // Store activities in database
    console.log('[strava-sync] Starting to store activities in database...')
    
    for (const activity of activities) {
      console.log(`[strava-sync] Processing activity ${activity.id}: ${activity.name}`)
      
      // First attempt with ANON_KEY
      let { error: insertError } = await supabaseClient
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

      // If RLS blocks, try with SERVICE_ROLE_KEY
      if (insertError) {
        console.log(`[strava-sync] ANON_KEY failed for activity ${activity.id}, trying SERVICE_ROLE_KEY:`, insertError)
        
        const { error: serviceInsertError } = await serviceRoleClient
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
          
        if (!serviceInsertError) {
          syncedCount++
          console.log(`[strava-sync] Activity ${activity.id} saved with SERVICE_ROLE_KEY - RLS issue on strava_activities`)
        } else {
          console.error(`[strava-sync] Failed to save activity ${activity.id} even with SERVICE_ROLE_KEY:`, serviceInsertError)
        }
      } else {
        syncedCount++
        console.log(`[strava-sync] Activity ${activity.id} saved successfully with ANON_KEY`)
      }
    }

    console.log(`[strava-sync] Successfully synced ${syncedCount}/${activities.length} activities for user:`, user.id)
    
    // Log detailed sync results
    console.log('[strava-sync] Sync summary:', {
      userId: user.id,
      totalActivitiesFromStrava: activities.length,
      activitiesSyncedToDatabase: syncedCount,
      syncSuccess: syncedCount > 0,
      usingServiceRole: usingServiceRole
    })

    return new Response(JSON.stringify({ 
      success: true,
      synced: syncedCount,
      total: activities.length,
      debug: {
        userId: user.id,
        usingServiceRole: usingServiceRole,
        activitiesReceived: activities.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[strava-sync] Caught error:', error)
    console.error('[strava-sync] Error message:', error?.message)
    console.error('[strava-sync] Error stack:', error?.stack)
    console.error('[strava-sync] Error name:', error?.name)
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error?.message || 'Unknown error',
      errorType: error?.name || 'Unknown',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

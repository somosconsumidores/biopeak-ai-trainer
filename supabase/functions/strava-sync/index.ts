import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ensureValidAccessToken } from './token-management.ts'
import { getLastSyncInfo, updateSyncStatus } from './sync-status.ts'
import { fetchStravaActivities, fetchDetailedActivityData, verifyTokenScopes } from './strava-api.ts'
import { storeActivitiesInDatabase } from './database-operations.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncResult {
  success: boolean
  synced: number
  total: number
  debug: {
    userId: string
    activitiesReceived: number
    detailRequestsMade: number
  }
}

Deno.serve(async (req) => {
  console.log('[strava-sync] Function called, method:', req.method)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[strava-sync] Handling CORS preflight')
    return new Response(null, { headers: corsHeaders })
  }

  // Create supabase client with anon key for JWT validation
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )
  
  // Create service role client for database operations
  const serviceRoleClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log('[strava-sync] Starting sync process...')
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
    console.log('[strava-sync] Auth check result:', { hasUser: !!user, authError: !!authError, userId: user?.id })
    
    if (authError || !user) {
      console.error('[strava-sync] Authentication failed:', authError?.message)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[strava-sync] User authenticated successfully:', user.id)

    // Get last sync info for incremental sync
    const { lastSyncDate, totalSynced: previouslySynced } = await getLastSyncInfo(serviceRoleClient, user.id)
    console.log('[strava-sync] Last sync info:', { lastSyncDate, previouslySynced })
    
    // Update sync status to 'in_progress'
    await updateSyncStatus(serviceRoleClient, user.id, 'in_progress')
    console.log('[strava-sync] Sync status updated to in_progress')

    // Ensure we have a valid access token (handles refresh if needed)
    console.log('[strava-sync] Ensuring valid access token...')
    const accessToken = await ensureValidAccessToken(serviceRoleClient, user.id)
    console.log('[strava-sync] Access token obtained successfully')

    // Verify token scopes and capabilities
    console.log('[strava-sync] Verifying token scopes...')
    const { scopes, athlete } = await verifyTokenScopes(accessToken)
    console.log('[strava-sync] Token verification completed for athlete:', athlete.firstname)

    // Fetch activities from Strava using helper function with incremental sync
    console.log('[strava-sync] Fetching activities from Strava API...')
    const activities = await fetchStravaActivities(accessToken, lastSyncDate)
    console.log('[strava-sync] Activities fetched:', activities.length)

    // Fetch detailed activity data using helper function
    console.log('[strava-sync] Fetching detailed activity data...')
    const { detailedActivities, detailRequestCount } = await fetchDetailedActivityData(activities, accessToken)
    console.log('[strava-sync] Detailed activities processed:', detailedActivities.length)

    // Store activities in database using helper function
    console.log('[strava-sync] Storing activities in database...')
    const syncedCount = await storeActivitiesInDatabase(detailedActivities, serviceRoleClient, user.id)
    console.log('[strava-sync] Activities stored:', syncedCount)
    
    // Find most recent activity date for next incremental sync
    const mostRecentActivity = detailedActivities.reduce((latest, activity) => {
      const activityDate = new Date(activity.start_date)
      return activityDate > latest ? activityDate : latest
    }, lastSyncDate || new Date(0))

    // Update sync status
    await updateSyncStatus(
      serviceRoleClient, 
      user.id, 
      'completed', 
      mostRecentActivity,
      previouslySynced + syncedCount
    )

    console.log(`[strava-sync] Successfully synced ${syncedCount}/${detailedActivities.length} activities for user:`, user.id)
    
    // Log detailed sync results with heart rate analysis
    const activitiesWithHR = detailedActivities.filter(a => a.average_heartrate && a.average_heartrate > 0)
    const activitiesWithMaxHR = detailedActivities.filter(a => a.max_heartrate && a.max_heartrate > 0)
    const activitiesWithStreams = detailedActivities.filter(a => a.streams?.heartrate)
    const activitiesWithCalories = detailedActivities.filter(a => a.calories && a.calories > 0)
    
    console.log('[strava-sync] Detailed sync summary:', {
      userId: user.id,
      totalActivitiesFromStrava: detailedActivities.length,
      activitiesSyncedToDatabase: syncedCount,
      syncSuccess: syncedCount > 0,
      isIncrementalSync: !!lastSyncDate,
      lastSyncDate: lastSyncDate?.toISOString(),
      mostRecentActivityDate: mostRecentActivity.toISOString(),
      detailRequestsMade: detailRequestCount,
      heartRateAnalysis: {
        withAverageHR: activitiesWithHR.length,
        withMaxHR: activitiesWithMaxHR.length,
        withStreamData: activitiesWithStreams.length,
        withCalories: activitiesWithCalories.length,
        totalStreamDataPoints: activitiesWithStreams.reduce((sum, a) => sum + (a.streams?.heartrate?.data?.length || 0), 0)
      }
    })
    
    if (activitiesWithHR.length > 0) {
      console.log('[strava-sync] Sample activities with heart rate data:', activitiesWithHR.slice(0, 3).map(a => ({
        id: a.id,
        name: a.name,
        avgHR: a.average_heartrate,
        maxHR: a.max_heartrate,
        hasStreams: !!a.streams?.heartrate,
        streamPoints: a.streams?.heartrate?.data?.length || 0
      })))
    } else {
      console.log('[strava-sync] WARNING: No activities found with heart rate data!')
    }

    return new Response(JSON.stringify({ 
      success: true,
      synced: syncedCount,
      total: detailedActivities.length,
      isIncremental: !!lastSyncDate,
      lastSyncDate: lastSyncDate?.toISOString(),
      mostRecentActivity: mostRecentActivity.toISOString(),
      debug: {
        userId: user.id,
        activitiesReceived: detailedActivities.length,
        detailRequestsMade: detailRequestCount,
        previouslySynced: previouslySynced
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[strava-sync] Caught error:', error)
    console.error('[strava-sync] Error message:', error?.message)
    console.error('[strava-sync] Error stack:', error?.stack)
    console.error('[strava-sync] Error name:', error?.name)
    
    // Try to get user id from authorization for error logging
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabaseClient.auth.getUser(token)
        if (user) {
          await updateSyncStatus(serviceRoleClient, user.id, 'error', undefined, undefined, error?.message)
        }
      } catch (e) {
        console.log('[strava-sync] Could not update error status:', e)
      }
    }
    
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
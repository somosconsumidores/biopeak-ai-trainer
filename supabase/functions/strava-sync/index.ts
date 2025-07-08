import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ensureValidAccessToken } from './token-management.ts'
import { getLastSyncInfo, updateSyncStatus } from './sync-status.ts'
import { fetchStravaActivities, fetchDetailedActivityData } from './strava-api.ts'
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

  // Create supabase client outside try block for error handling
  const supabaseClient = createClient(
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
    console.log('[strava-sync] Auth check result:', { hasUser: !!user, authError: !!authError })
    
    if (authError || !user) {
      console.error('[strava-sync] Authentication failed:', authError?.message)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get last sync info for incremental sync
    const { lastSyncDate, totalSynced: previouslySynced } = await getLastSyncInfo(supabaseClient, user.id)
    
    // Update sync status to 'in_progress'
    await updateSyncStatus(supabaseClient, user.id, 'in_progress')

    // Ensure we have a valid access token (handles refresh if needed)
    const accessToken = await ensureValidAccessToken(supabaseClient, user.id)

    // Fetch activities from Strava using helper function with incremental sync
    const activities = await fetchStravaActivities(accessToken, lastSyncDate)

    // Fetch detailed activity data using helper function
    const { detailedActivities, detailRequestCount } = await fetchDetailedActivityData(activities, accessToken)

    // Store activities in database using helper function
    const syncedCount = await storeActivitiesInDatabase(detailedActivities, supabaseClient, user.id)
    
    // Find most recent activity date for next incremental sync
    const mostRecentActivity = detailedActivities.reduce((latest, activity) => {
      const activityDate = new Date(activity.start_date)
      return activityDate > latest ? activityDate : latest
    }, lastSyncDate || new Date(0))

    // Update sync status
    await updateSyncStatus(
      supabaseClient, 
      user.id, 
      'completed', 
      mostRecentActivity,
      previouslySynced + syncedCount
    )

    console.log(`[strava-sync] Successfully synced ${syncedCount}/${detailedActivities.length} activities for user:`, user.id)
    
    // Log detailed sync results
    console.log('[strava-sync] Sync summary:', {
      userId: user.id,
      totalActivitiesFromStrava: detailedActivities.length,
      activitiesSyncedToDatabase: syncedCount,
      syncSuccess: syncedCount > 0,
      isIncrementalSync: !!lastSyncDate,
      lastSyncDate: lastSyncDate?.toISOString(),
      mostRecentActivityDate: mostRecentActivity.toISOString(),
      detailRequestsMade: detailRequestCount
    })

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
          await updateSyncStatus(supabaseClient, user.id, 'error', undefined, undefined, error?.message)
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
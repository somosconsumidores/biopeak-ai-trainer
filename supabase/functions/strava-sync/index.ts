
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

interface StravaTokenData {
  access_token: string
  refresh_token: string
  expires_at: string
}

interface SyncResult {
  success: boolean
  synced: number
  total: number
  debug: {
    userId: string
    usingServiceRole: boolean
    activitiesReceived: number
    detailRequestsMade: number
  }
}

// Helper function to get user's Strava tokens
async function getStravaTokens(supabaseClient: any, userId: string): Promise<StravaTokenData> {
  console.log('[strava-sync] Fetching Strava tokens for user:', userId)
  
  const { data: tokenData, error: tokenError } = await supabaseClient
    .from('strava_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  console.log('[strava-sync] Token fetch result:', {
    hasTokenData: !!tokenData,
    tokenError: tokenError,
    userId: userId
  })

  if (tokenError) {
    console.error('[strava-sync] Error fetching Strava tokens:', tokenError)
    throw new Error('Error fetching Strava connection')
  }
  
  if (!tokenData) {
    console.log('[strava-sync] No Strava tokens found for user:', userId)
    throw new Error('Strava not connected')
  }

  return tokenData
}

// Helper function to refresh expired Strava tokens
async function refreshStravaToken(tokenData: StravaTokenData, supabaseClient: any, userId: string): Promise<string> {
  console.log('Token expired, refreshing...')
  
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
    throw new Error(`Failed to refresh Strava token: ${errorText}`)
  }

  const refreshData = await refreshResponse.json()

  // Update tokens in database
  const { error: updateError } = await supabaseClient
    .from('strava_tokens')
    .update({
      access_token: refreshData.access_token,
      refresh_token: refreshData.refresh_token,
      expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
    })
    .eq('user_id', userId)
  
  if (updateError) {
    console.error('[strava-sync] Error updating refreshed tokens:', updateError)
  }

  return refreshData.access_token
}

// Helper function to get last sync info for incremental sync
async function getLastSyncInfo(supabaseClient: any, userId: string): Promise<{ lastSyncDate: Date | null, totalSynced: number }> {
  const { data: syncStatus } = await supabaseClient
    .from('strava_sync_status')
    .select('last_activity_date, total_activities_synced')
    .eq('user_id', userId)
    .maybeSingle()
  
  return {
    lastSyncDate: syncStatus?.last_activity_date ? new Date(syncStatus.last_activity_date) : null,
    totalSynced: syncStatus?.total_activities_synced || 0
  }
}

// Helper function to update sync status
async function updateSyncStatus(supabaseClient: any, userId: string, status: string, lastActivityDate?: Date, syncedCount?: number, errorMessage?: string) {
  const updateData: any = {
    sync_status: status,
    last_sync_at: new Date().toISOString()
  }
  
  if (lastActivityDate) updateData.last_activity_date = lastActivityDate.toISOString()
  if (syncedCount !== undefined) updateData.total_activities_synced = syncedCount
  if (errorMessage) updateData.error_message = errorMessage
  
  await supabaseClient
    .from('strava_sync_status')
    .upsert({
      user_id: userId,
      ...updateData
    })
}

// Helper function to fetch activities from Strava API with incremental sync
async function fetchStravaActivities(accessToken: string, lastSyncDate: Date | null): Promise<StravaActivity[]> {
  console.log('[strava-sync] Fetching activities from Strava API...')
  
  const activities: StravaActivity[] = []
  let page = 1
  const perPage = 200
  const maxActivities = 500 // Increased limit for better coverage
  
  // Build URL with after parameter for incremental sync
  let baseUrl = `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`
  if (lastSyncDate) {
    const afterTimestamp = Math.floor(lastSyncDate.getTime() / 1000)
    baseUrl += `&after=${afterTimestamp}`
    console.log(`[strava-sync] Incremental sync: fetching activities after ${lastSyncDate.toISOString()}`)
  } else {
    console.log('[strava-sync] Full sync: fetching all recent activities')
  }
  
  while (activities.length < maxActivities) {
    console.log(`[strava-sync] Fetching page ${page}`)
    const response = await fetch(`${baseUrl}&page=${page}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[strava-sync] Failed to fetch Strava activities (page ${page}):`, errorText)
      if (page === 1) {
        throw new Error('Failed to fetch activities from Strava')
      }
      break // Continue with what we have if later pages fail
    }

    const pageActivities: StravaActivity[] = await response.json()
    console.log(`[strava-sync] Received ${pageActivities.length} activities from page ${page}`)
    
    if (pageActivities.length === 0) {
      console.log('[strava-sync] No more activities to fetch')
      break
    }
    
    activities.push(...pageActivities)
    
    // If we got fewer than perPage activities, we've reached the end
    if (pageActivities.length < perPage) {
      console.log('[strava-sync] Reached end of activities')
      break
    }
    
    page++
  }
  
  console.log(`[strava-sync] Total activities fetched: ${activities.length}`)
  return activities
}

// Helper function to fetch detailed activity data
async function fetchDetailedActivityData(activities: StravaActivity[], accessToken: string): Promise<{ detailedActivities: StravaActivity[], detailRequestCount: number }> {
  console.log('[strava-sync] Starting optimized detailed data fetch...')
  
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const detailedActivities: StravaActivity[] = []
  let detailRequestCount = 0
  
  // Sort activities by date (most recent first) and limit to 50 for detailed processing
  const sortedActivities = activities.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
  const maxDetailedActivities = 50
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  // Prioritize recent activities (last 30 days)
  const recentActivities = sortedActivities.filter(activity => 
    new Date(activity.start_date) >= thirtyDaysAgo
  ).slice(0, maxDetailedActivities)
  
  // Add older activities up to the limit
  const olderActivities = sortedActivities.filter(activity => 
    new Date(activity.start_date) < thirtyDaysAgo
  ).slice(0, Math.max(0, maxDetailedActivities - recentActivities.length))
  
  const activitiesToProcess = [...recentActivities, ...olderActivities].slice(0, maxDetailedActivities)
  
  console.log(`[strava-sync] Processing detailed data for ${activitiesToProcess.length} activities (${recentActivities.length} recent, ${olderActivities.length} older)`)
  
  // Track execution time to prevent timeouts
  const startTime = Date.now()
  const maxExecutionTime = 120000 // 2 minutes max for detailed processing
  
  for (let i = 0; i < activitiesToProcess.length; i++) {
    const activity = activitiesToProcess[i]
    
    // Check execution time - stop if approaching timeout
    if (Date.now() - startTime > maxExecutionTime) {
      console.log(`[strava-sync] Stopping detailed processing due to time limit after ${i} activities`)
      // Add remaining activities without detailed data
      detailedActivities.push(...activitiesToProcess.slice(i))
      break
    }
    
    // Check if we already have detailed data (heart rate or calories)
    if (activity.average_heartrate || activity.calories) {
      console.log(`[strava-sync] Activity ${activity.id} already has detailed data, skipping`)
      detailedActivities.push(activity)
      continue
    }
    
    try {
      console.log(`[strava-sync] Fetching detailed data for activity ${activity.id} (${i + 1}/${activitiesToProcess.length})`)
      
      // Reduced delay to 1 second to speed up processing
      if (detailRequestCount > 0) {
        await delay(1000) // 1 second delay between detailed requests
      }
      
      const detailResponse = await fetch(
        `https://www.strava.com/api/v3/activities/${activity.id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )
      
      detailRequestCount++
      
      if (detailResponse.ok) {
        const detailedActivity = await detailResponse.json()
        console.log(`[strava-sync] Got detailed data for activity ${activity.id} - HR: ${detailedActivity.average_heartrate}, Calories: ${detailedActivity.calories}`)
        
        // Merge detailed data with basic activity data
        const enrichedActivity = {
          ...activity,
          average_heartrate: detailedActivity.average_heartrate || activity.average_heartrate,
          max_heartrate: detailedActivity.max_heartrate || activity.max_heartrate,
          calories: detailedActivity.calories || activity.calories,
        }
        
        detailedActivities.push(enrichedActivity)
      } else {
        console.warn(`[strava-sync] Failed to fetch detailed data for activity ${activity.id}, status: ${detailResponse.status}`)
        detailedActivities.push(activity) // Keep original data
      }
      
      // Log progress every 5 activities
      if ((i + 1) % 5 === 0) {
        console.log(`[strava-sync] Processed ${i + 1}/${activitiesToProcess.length} activities for detailed data`)
      }
      
    } catch (error) {
      console.error(`[strava-sync] Error fetching detailed data for activity ${activity.id}:`, error)
      detailedActivities.push(activity) // Keep original data
    }
  }
  
  // Add any remaining activities that weren't processed for detailed data
  const processedIds = new Set(detailedActivities.map(a => a.id))
  const remainingActivities = activities.filter(a => !processedIds.has(a.id))
  detailedActivities.push(...remainingActivities)
  
  console.log(`[strava-sync] Completed detailed data fetch. Made ${detailRequestCount} detail requests.`)
  return { detailedActivities, detailRequestCount }
}

// Helper function to store activities in database
async function storeActivitiesInDatabase(activities: StravaActivity[], supabaseClient: any, userId: string): Promise<number> {
  console.log('[strava-sync] Starting to store activities in database...')
  let syncedCount = 0
  const batchSize = 10 // Process in smaller batches for better performance
  
  for (let i = 0; i < activities.length; i += batchSize) {
    const batch = activities.slice(i, i + batchSize)
    console.log(`[strava-sync] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activities.length / batchSize)}`)
    
    const batchData = batch.map(activity => ({
      user_id: userId,
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
    }))
    
    const { error: insertError, count } = await supabaseClient
      .from('strava_activities')
      .upsert(batchData, {
        onConflict: 'user_id,strava_activity_id',
        count: 'exact'
      })

    if (insertError) {
      console.error(`[strava-sync] Error saving batch:`, insertError)
      // Try individual inserts for this batch
      for (const activity of batch) {
        const { error: singleError } = await supabaseClient
          .from('strava_activities')
          .upsert({
            user_id: userId,
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
            onConflict: 'user_id,strava_activity_id'
          })
        
        if (!singleError) {
          syncedCount++
          console.log(`[strava-sync] Activity ${activity.id} saved individually`)
        } else {
          console.error(`[strava-sync] Failed to save activity ${activity.id}:`, singleError)
        }
      }
    } else {
      syncedCount += count || batch.length
      console.log(`[strava-sync] Batch of ${batch.length} activities saved successfully`)
    }
  }

  console.log(`[strava-sync] Successfully synced ${syncedCount}/${activities.length} activities`)
  return syncedCount
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
    const tokenData = await getStravaTokens(supabaseClient, user.id)
    
    // Get last sync info for incremental sync
    const { lastSyncDate, totalSynced: previouslySynced } = await getLastSyncInfo(supabaseClient, user.id)
    
    // Update sync status to 'in_progress'
    await updateSyncStatus(supabaseClient, user.id, 'in_progress')

    // Check if token is expired and refresh if needed
    const now = new Date()
    const expiresAt = new Date(tokenData.expires_at)
    let accessToken = tokenData.access_token

    if (now >= expiresAt) {
      accessToken = await refreshStravaToken(tokenData, supabaseClient, user.id)
    }

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

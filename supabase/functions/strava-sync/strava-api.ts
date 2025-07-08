export interface StravaActivity {
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
  streams?: StravaActivityStreams
}

export interface StravaActivityStreams {
  heartrate?: {
    type: string
    data: number[]
    series_type: string
    original_size: number
    resolution: string
  }
}

// Helper function to verify token scopes
export async function verifyTokenScopes(accessToken: string): Promise<{ scopes: string[], athlete: any }> {
  try {
    console.log('[strava-sync] Verifying token scopes...')
    
    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })
    
    if (!response.ok) {
      throw new Error(`Failed to verify token: ${response.status}`)
    }
    
    const athlete = await response.json()
    const scopes = response.headers.get('X-RateLimit-Usage')?.split(',') || []
    
    console.log('[strava-sync] Token verification successful:', {
      athleteId: athlete.id,
      athleteName: athlete.firstname + ' ' + athlete.lastname,
      scopes: scopes,
      hasHeartRateAccess: scopes.includes('read_all') || scopes.includes('read')
    })
    
    return { scopes, athlete }
  } catch (error) {
    console.error('[strava-sync] Error verifying token:', error)
    throw error
  }
}

// Helper function to fetch activities from Strava API with incremental sync
export async function fetchStravaActivities(accessToken: string, lastSyncDate: Date | null): Promise<StravaActivity[]> {
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

// Helper function to fetch activity streams (heart rate data) with retry logic
export async function fetchActivityStreams(activityId: number, accessToken: string, retryCount: number = 3): Promise<StravaActivityStreams | null> {
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`[strava-sync] Fetching streams for activity ${activityId} (attempt ${attempt}/${retryCount})`)
      
      const response = await fetch(
        `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=heartrate&key_by_type=true`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )
      
      if (response.ok) {
        const streamData = await response.json()
        console.log(`[strava-sync] Successfully fetched streams for activity ${activityId}:`, {
          hasHeartrate: !!streamData.heartrate,
          heartrateDataPoints: streamData.heartrate?.data?.length || 0,
          streamKeys: Object.keys(streamData || {})
        })
        return streamData
      } else if (response.status === 404) {
        console.log(`[strava-sync] No streams available for activity ${activityId} (404)`)
        return null
      } else if (response.status === 429) {
        console.log(`[strava-sync] Rate limited for activity ${activityId}, waiting before retry...`)
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)) // Exponential backoff
        continue
      } else {
        console.log(`[strava-sync] Failed to fetch streams for activity ${activityId}, status: ${response.status}`)
        if (attempt === retryCount) return null
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    } catch (error) {
      console.error(`[strava-sync] Error fetching streams for activity ${activityId} (attempt ${attempt}):`, error)
      if (attempt === retryCount) return null
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
  return null
}

// Helper function to fetch detailed activity data
export async function fetchDetailedActivityData(activities: StravaActivity[], accessToken: string): Promise<{ detailedActivities: StravaActivity[], detailRequestCount: number }> {
  console.log('[strava-sync] Starting detailed data fetch with enhanced logging...')
  
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const detailedActivities: StravaActivity[] = []
  let detailRequestCount = 0
  
  // Sort activities by date (most recent first) and increase limit to 200 for better coverage
  const sortedActivities = activities.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
  const maxDetailedActivities = 200 // Increased from 50
  
  // Remove 30-day limitation - process all activities up to the limit
  const activitiesToProcess = sortedActivities.slice(0, maxDetailedActivities)
  
  console.log(`[strava-sync] Processing detailed data for ${activitiesToProcess.length} activities (no date filtering applied)`)
  console.log(`[strava-sync] Sample activities to process:`, activitiesToProcess.slice(0, 3).map(a => ({ id: a.id, name: a.name, type: a.type, start_date: a.start_date })))
  
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
    
    // Always process activities to ensure we get detailed data - remove the skip logic
    console.log(`[strava-sync] Processing activity ${activity.id} (${i + 1}/${activitiesToProcess.length}) - ${activity.name} (${activity.type})`)
    
    try {
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
        
        // Log detailed information about the response
        console.log(`[strava-sync] Detailed activity ${activity.id} response:`, {
          has_heartrate: !!detailedActivity.has_heartrate,
          average_heartrate: detailedActivity.average_heartrate,
          max_heartrate: detailedActivity.max_heartrate,
          calories: detailedActivity.calories,
          device_name: detailedActivity.device_name,
          has_kudosed: detailedActivity.has_kudosed,
          workout_type: detailedActivity.workout_type
        })
        
        // Fetch stream data (heart rate time-series) - always attempt this
        console.log(`[strava-sync] Attempting to fetch stream data for activity ${activity.id}`)
        const streamData = await fetchActivityStreams(activity.id, accessToken)
        
        // Merge detailed data with basic activity data
        const enrichedActivity = {
          ...activity,
          average_heartrate: detailedActivity.average_heartrate || activity.average_heartrate,
          max_heartrate: detailedActivity.max_heartrate || activity.max_heartrate,
          calories: detailedActivity.calories || activity.calories,
          streams: streamData
        }
        
        console.log(`[strava-sync] Final enriched activity ${activity.id}:`, {
          final_average_heartrate: enrichedActivity.average_heartrate,
          final_max_heartrate: enrichedActivity.max_heartrate,
          final_calories: enrichedActivity.calories,
          has_streams: !!enrichedActivity.streams,
          stream_heartrate_points: enrichedActivity.streams?.heartrate?.data?.length || 0
        })
        
        detailedActivities.push(enrichedActivity)
      } else {
        const errorText = await detailResponse.text()
        console.error(`[strava-sync] Failed to fetch detailed data for activity ${activity.id}, status: ${detailResponse.status}, error: ${errorText}`)
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
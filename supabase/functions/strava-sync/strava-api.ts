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

// Helper function to fetch detailed activity data
export async function fetchDetailedActivityData(activities: StravaActivity[], accessToken: string): Promise<{ detailedActivities: StravaActivity[], detailRequestCount: number }> {
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
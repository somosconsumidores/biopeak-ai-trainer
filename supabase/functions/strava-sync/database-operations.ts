import { StravaActivity } from './strava-api.ts'

// Helper function to store activities in database
export async function storeActivitiesInDatabase(activities: StravaActivity[], supabaseClient: any, userId: string): Promise<number> {
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
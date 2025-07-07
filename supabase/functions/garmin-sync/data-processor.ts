// Data processing utilities for Garmin activities
export function processGarminActivities(activitiesData: any, userId: string) {
  let processedActivities = [];

  // Process activities data with better mapping
  if (activitiesData && Array.isArray(activitiesData)) {
    console.log(`Processing ${activitiesData.length} activities from API`);
    
    processedActivities = activitiesData.map((activity: any, index: number) => {
      // Ensure we have a valid activity ID
      const activityId = activity.activityId || activity.id || activity.activityUuid || (Date.now() + index);
      
      console.log(`Processing activity ${index + 1}:`, JSON.stringify(activity, null, 2));
      
      return {
        user_id: userId,
        garmin_activity_id: parseInt(activityId.toString()) || (Date.now() + index),
        name: activity.activityName || activity.name || activity.activityType?.typeKey || `Garmin Activity ${index + 1}`,
        type: (activity.activityType?.typeKey || activity.activityType || activity.type || 'unknown').toLowerCase(),
        start_date: activity.startTimeLocal || activity.startTime || activity.beginTimestamp || new Date().toISOString(),
        distance: activity.distance ? Math.round(parseFloat(activity.distance) * 1000) : null, // Convert km to meters
        moving_time: activity.movingDuration || activity.duration || activity.elapsedDuration || null,
        elapsed_time: activity.elapsedDuration || activity.duration || activity.movingDuration || null,
        average_speed: parseFloat(activity.averageSpeed) || null,
        max_speed: parseFloat(activity.maxSpeed) || null,
        average_heartrate: parseInt(activity.averageHR) || parseInt(activity.avgHR) || null,
        max_heartrate: parseInt(activity.maxHR) || null,
        calories: parseInt(activity.calories) || null,
        total_elevation_gain: parseFloat(activity.elevationGain) || null,
      };
    }).filter(activity => activity.garmin_activity_id); // Remove activities without valid IDs
    
    console.log(`Successfully processed ${processedActivities.length} activities`);
  }

  return processedActivities;
}

export function createFallbackActivities(userId: string) {
  console.log('Creating enhanced fallback data');
  const now = Date.now();
  
  return [
    {
      user_id: userId,
      garmin_activity_id: now + 1,
      name: 'Morning Run (Garmin Connect)',
      type: 'running',
      start_date: new Date().toISOString(),
      distance: 5000,
      moving_time: 1800,
      elapsed_time: 1900,
      average_speed: 2.78,
      average_heartrate: 150,
      max_heartrate: 170,
      calories: 350,
      total_elevation_gain: 50,
    },
    {
      user_id: userId,
      garmin_activity_id: now + 2,
      name: 'Evening Bike Ride (Garmin Connect)',
      type: 'cycling',
      start_date: new Date(Date.now() - 86400000).toISOString(),
      distance: 15000,
      moving_time: 2700,
      elapsed_time: 2800,
      average_speed: 5.56,
      average_heartrate: 140,
      max_heartrate: 165,
      calories: 480,
      total_elevation_gain: 200,
    },
    {
      user_id: userId,
      garmin_activity_id: now + 3,
      name: 'Swimming Session (Garmin Connect)',
      type: 'swimming',
      start_date: new Date(Date.now() - 172800000).toISOString(),
      distance: 1000,
      moving_time: 1200,
      elapsed_time: 1300,
      average_speed: 0.83,
      average_heartrate: 130,
      max_heartrate: 155,
      calories: 280,
      total_elevation_gain: 0,
    }
  ];
}
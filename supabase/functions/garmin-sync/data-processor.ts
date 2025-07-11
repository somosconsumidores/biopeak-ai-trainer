// Data processing utilities for Garmin activities and daily health data

// Process Activity API response data
export function processGarminActivities(activitiesData: any, userId: string) {
  console.log('Processing Garmin activities for user:', userId);
  console.log('Raw activities data type:', typeof activitiesData);
  console.log('Raw activities data length:', Array.isArray(activitiesData) ? activitiesData.length : 'Not array');
  console.log('Raw activities data structure:', JSON.stringify(activitiesData, null, 2));
  
  if (!Array.isArray(activitiesData)) {
    console.warn('Activities data is not an array:', typeof activitiesData);
    return [];
  }

  return activitiesData.map((activity: any, index: number) => {
    console.log(`\n=== PROCESSING ACTIVITY ${index + 1}/${activitiesData.length} ===`);
    console.log('Raw activity keys:', Object.keys(activity || {}));
    console.log('Full activity object:', JSON.stringify(activity, null, 2));
    
    // Look for different possible structures in the Garmin API response
    // Based on official Garmin wellness API documentation
    const activityId = activity.activityId || activity.summaryId || activity.id || Math.floor(Math.random() * 1000000);
    const activityName = activity.activityName || activity.name || activity.activityType?.parent?.parentName || 'Untitled Activity';
    
    // Handle nested activityType structure from Garmin
    let activityType = 'Unknown';
    if (activity.activityType) {
      if (typeof activity.activityType === 'string') {
        activityType = activity.activityType;
      } else if (activity.activityType.typeKey) {
        activityType = activity.activityType.typeKey;
      } else if (activity.activityType.parent?.parentName) {
        activityType = activity.activityType.parent.parentName;
      }
    }
    
    // Extract timestamps - Garmin uses various formats
    const startDate = activity.startTimeGMT || activity.startTimeLocal || activity.beginTimestamp || new Date().toISOString();
    
    // Extract activity metrics with Garmin-specific field names
    const distance = activity.distance || activity.distanceInMeters || null;
    const movingTime = activity.movingDuration || activity.elapsedDuration || activity.duration || null;
    const elapsedTime = activity.elapsedDuration || activity.duration || null;
    const elevationGain = activity.elevationGain || activity.elevationCorrected || null;
    
    // Speed metrics (Garmin uses m/s typically)
    const avgSpeed = activity.averageSpeed || activity.avgSpeed || null;
    const maxSpeed = activity.maxSpeed || activity.maximumSpeed || null;
    
    // Heart rate metrics
    const avgHR = activity.averageHR || activity.avgHeartRate || activity.averageHeartRate || null;
    const maxHR = activity.maxHR || activity.maxHeartRate || activity.maximumHeartRate || null;
    
    // Calories
    const calories = activity.calories || activity.activeKilocalories || null;
    
    console.log('Mapped Garmin fields:', {
      original_activityId: activity.activityId,
      original_summaryId: activity.summaryId,
      mapped_activityId: activityId,
      original_activityName: activity.activityName,
      mapped_activityName: activityName,
      original_activityType: activity.activityType,
      mapped_activityType: activityType,
      original_startTimeGMT: activity.startTimeGMT,
      original_startTimeLocal: activity.startTimeLocal,
      mapped_startDate: startDate,
      original_distance: activity.distance,
      original_distanceInMeters: activity.distanceInMeters,
      mapped_distance: distance,
      original_movingDuration: activity.movingDuration,
      original_elapsedDuration: activity.elapsedDuration,
      mapped_movingTime: movingTime,
      mapped_elapsedTime: elapsedTime,
      original_calories: activity.calories,
      original_activeKilocalories: activity.activeKilocalories,
      mapped_calories: calories
    });
    
    const processedActivity = {
      user_id: userId,
      garmin_activity_id: activityId,
      name: activityName,
      type: activityType,
      start_date: startDate,
      distance: distance ? parseFloat(distance.toString()) : null,
      moving_time: movingTime ? parseInt(movingTime.toString()) : null,
      elapsed_time: elapsedTime ? parseInt(elapsedTime.toString()) : null,
      total_elevation_gain: elevationGain ? parseFloat(elevationGain.toString()) : null,
      average_speed: avgSpeed ? parseFloat(avgSpeed.toString()) : null,
      max_speed: maxSpeed ? parseFloat(maxSpeed.toString()) : null,
      average_heartrate: avgHR ? parseInt(avgHR.toString()) : null,
      max_heartrate: maxHR ? parseInt(maxHR.toString()) : null,
      calories: calories ? parseFloat(calories.toString()) : null
    };
    
    console.log('Final processed activity:', processedActivity);
    console.log(`=== ACTIVITY ${index + 1} PROCESSING COMPLETE ===\n`);
    return processedActivity;
  });
}

// Process Daily Health Stats API response data
export function processDailyHealthData(healthData: any, userId: string) {
  console.log('Processing Garmin daily health data for user:', userId);
  console.log('Raw health data:', JSON.stringify(healthData, null, 2));
  
  if (!Array.isArray(healthData)) {
    console.warn('Health data is not an array:', typeof healthData);
    return [];
  }

  return healthData.map((dayData: any) => {
    const processedHealth = {
      user_id: userId,
      summary_date: dayData.summaryDate || dayData.calendarDate || new Date().toISOString().split('T')[0],
      steps: dayData.totalSteps || dayData.steps || null,
      distance_in_meters: dayData.totalDistanceMeters || dayData.distance || null,
      calories_burned: dayData.totalKilocalories || dayData.calories || null,
      active_time_in_seconds: dayData.activeTimeInSeconds || null,
      floors_climbed: dayData.floorsClimbed || null,
      resting_heart_rate: dayData.restingHeartRate || null,
      stress_score: dayData.maxStressLevel || null,
      sleep_duration_in_seconds: dayData.sleepTimeSeconds || null,
      awake_duration_in_seconds: dayData.awakeDurationInSeconds || null,
      light_sleep_duration_in_seconds: dayData.lightSleepDurationInSeconds || null,
      deep_sleep_duration_in_seconds: dayData.deepSleepDurationInSeconds || null,
      rem_sleep_duration_in_seconds: dayData.remSleepDurationInSeconds || null,
      body_battery_charged: dayData.bodyBatteryChargedValue || null,
      body_battery_drained: dayData.bodyBatteryDrainedValue || null,
      moderate_intensity_minutes: dayData.moderateIntensityDurationInSeconds ? Math.floor(dayData.moderateIntensityDurationInSeconds / 60) : null,
      vigorous_intensity_minutes: dayData.vigorousIntensityDurationInSeconds ? Math.floor(dayData.vigorousIntensityDurationInSeconds / 60) : null
    };
    
    console.log('Processed health data:', processedHealth);
    return processedHealth;
  });
}

// Create fallback activities for demo purposes
export function createFallbackActivities(userId: string) {
  console.log('Creating fallback activities for user:', userId);
  
  const fallbackActivities = [
    {
      user_id: userId,
      garmin_activity_id: Math.floor(Math.random() * 1000000),
      name: 'Demo Running Activity',
      type: 'Running',
      start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      distance: 5000,
      moving_time: 1800,
      elapsed_time: 1920,
      total_elevation_gain: 50,
      average_speed: 2.78,
      max_speed: 3.5,
      average_heartrate: 150,
      max_heartrate: 170,
      calories: 350
    }
  ];
  
  console.log('Created fallback activities:', fallbackActivities);
  return fallbackActivities;
}

// Create fallback daily health data for demo purposes
export function createFallbackDailyHealth(userId: string) {
  console.log('Creating fallback daily health data for user:', userId);
  
  const fallbackHealth = [];
  for (let i = 0; i < 3; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    fallbackHealth.push({
      user_id: userId,
      summary_date: date.toISOString().split('T')[0],
      steps: 8000 + Math.floor(Math.random() * 4000),
      distance_in_meters: 6000 + Math.floor(Math.random() * 3000),
      calories_burned: 2000 + Math.floor(Math.random() * 500),
      active_time_in_seconds: 3600 + Math.floor(Math.random() * 1800),
      floors_climbed: Math.floor(Math.random() * 20),
      resting_heart_rate: 55 + Math.floor(Math.random() * 15),
      stress_score: Math.floor(Math.random() * 100),
      sleep_duration_in_seconds: 25200 + Math.floor(Math.random() * 7200)
    });
  }
  
  console.log('Created fallback health data:', fallbackHealth);
  return fallbackHealth;
}
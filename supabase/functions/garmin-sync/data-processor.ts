// Data processing utilities for Garmin activities and daily health data

// Process Activity API response data
export function processGarminActivities(activitiesData: any, userId: string) {
  console.log('Processing Garmin activities for user:', userId);
  console.log('Raw activities data:', JSON.stringify(activitiesData, null, 2));
  
  if (!Array.isArray(activitiesData)) {
    console.warn('Activities data is not an array:', typeof activitiesData);
    return [];
  }

  return activitiesData.map((activity: any) => {
    const processedActivity = {
      user_id: userId,
      garmin_activity_id: activity.activityId || activity.id || Math.floor(Math.random() * 1000000),
      name: activity.activityName || activity.name || 'Untitled Activity',
      type: activity.activityType?.typeKey || activity.type || 'Unknown',
      start_date: activity.startTimeLocal || activity.startTime || new Date().toISOString(),
      distance: activity.distance ? parseFloat(activity.distance) : null,
      moving_time: activity.movingDuration || activity.duration || null,
      elapsed_time: activity.elapsedDuration || activity.duration || null,
      total_elevation_gain: activity.elevationGain ? parseFloat(activity.elevationGain) : null,
      average_speed: activity.averageSpeed ? parseFloat(activity.averageSpeed) : null,
      max_speed: activity.maxSpeed ? parseFloat(activity.maxSpeed) : null,
      average_heartrate: activity.averageHR || activity.avgHeartRate || null,
      max_heartrate: activity.maxHR || activity.maxHeartRate || null,
      calories: activity.calories ? parseFloat(activity.calories) : null
    };
    
    console.log('Processed activity:', processedActivity);
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
// Data processing utilities for Garmin activities and daily health data

// Process Activity API response data
export function processGarminActivities(activitiesData: any, userId: string) {
  let processedActivities = [];

  // Process activities data with better mapping for Activity API
  if (activitiesData && Array.isArray(activitiesData)) {
    console.log(`Processing ${activitiesData.length} activities from Activity API`);
    
    processedActivities = activitiesData.map((activity: any, index: number) => {
      // Map Activity API response fields to our database structure
      const activityId = activity.activityId || activity.summaryId || activity.id || (Date.now() + index);
      
      console.log(`Processing activity ${index + 1}:`, JSON.stringify(activity, null, 2));
      
      return {
        user_id: userId,
        garmin_activity_id: parseInt(activityId.toString()) || (Date.now() + index),
        name: activity.activityName || activity.name || `${activity.activityType || 'Activity'} ${index + 1}`,
        type: (activity.activityType || activity.sportType || 'unknown').toLowerCase(),
        start_date: activity.startTimeInSeconds 
          ? new Date(activity.startTimeInSeconds * 1000).toISOString() 
          : activity.startTimeLocal || activity.startDate || new Date().toISOString(),
        distance: activity.distanceInMeters || activity.distance || null,
        moving_time: activity.durationInSeconds || activity.movingDuration || activity.duration || null,
        elapsed_time: activity.elapsedDurationInSeconds || activity.elapsedDuration || activity.durationInSeconds || null,
        average_speed: activity.averageSpeedInMetersPerSecond || activity.averageSpeed || null,
        max_speed: activity.maxSpeedInMetersPerSecond || activity.maxSpeed || null,
        average_heartrate: activity.averageHeartRateInBeatsPerMinute || activity.averageHR || activity.avgHeartRate || null,
        max_heartrate: activity.maxHeartRateInBeatsPerMinute || activity.maxHR || activity.maxHeartRate || null,
        calories: activity.activeKilocalories || activity.calories || null,
        total_elevation_gain: activity.totalElevationGainInMeters || activity.elevationGain || null,
      };
    }).filter(activity => activity.garmin_activity_id); // Remove activities without valid IDs
    
    console.log(`Successfully processed ${processedActivities.length} activities`);
  }

  return processedActivities;
}

// Process Daily Health Stats API response data
export function processDailyHealthData(healthData: any, userId: string) {
  let processedHealthData = [];

  if (healthData && Array.isArray(healthData)) {
    console.log(`Processing ${healthData.length} daily health records from Daily Health Stats API`);
    
    processedHealthData = healthData.map((daily: any) => {
      // Map Daily Health Stats API response fields to our database structure
      const summaryDate = daily.calendarDate || daily.summaryDate || daily.date;
      
      console.log(`Processing daily health record:`, JSON.stringify(daily, null, 2));
      
      return {
        user_id: userId,
        summary_date: summaryDate,
        steps: daily.totalSteps || daily.steps || null,
        distance_in_meters: daily.totalDistanceMeters || daily.distanceInMeters || null,
        active_time_in_seconds: daily.activeTimeInSeconds || daily.activeTime || null,
        calories_burned: daily.activeKilocalories || daily.totalCalories || daily.calories || null,
        floors_climbed: daily.floorsClimbed || daily.floors || null,
        sleep_duration_in_seconds: daily.sleepDurationInSeconds || daily.totalSleepTime || null,
        deep_sleep_duration_in_seconds: daily.deepSleepDurationInSeconds || daily.deepSleep || null,
        light_sleep_duration_in_seconds: daily.lightSleepDurationInSeconds || daily.lightSleep || null,
        rem_sleep_duration_in_seconds: daily.remSleepDurationInSeconds || daily.remSleep || null,
        awake_duration_in_seconds: daily.awakeDurationInSeconds || daily.awakeTime || null,
        resting_heart_rate: daily.restingHeartRateInBeatsPerMinute || daily.restingHR || null,
        stress_score: daily.maxStressLevel || daily.stressScore || null,
        body_battery_drained: daily.bodyBatteryDrained || null,
        body_battery_charged: daily.bodyBatteryCharged || null,
        moderate_intensity_minutes: daily.moderateIntensityDurationInSeconds ? Math.floor(daily.moderateIntensityDurationInSeconds / 60) : null,
        vigorous_intensity_minutes: daily.vigorousIntensityDurationInSeconds ? Math.floor(daily.vigorousIntensityDurationInSeconds / 60) : null,
      };
    }).filter(record => record.summary_date); // Remove records without valid dates
    
    console.log(`Successfully processed ${processedHealthData.length} daily health records`);
  }

  return processedHealthData;
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
    }
  ];
}

export function createFallbackDailyHealth(userId: string) {
  console.log('Creating fallback daily health data');
  const now = new Date();
  const healthData = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    healthData.push({
      user_id: userId,
      summary_date: date.toISOString().split('T')[0],
      steps: Math.floor(6000 + Math.random() * 8000), // 6-14k steps
      distance_in_meters: Math.floor(4000 + Math.random() * 6000), // 4-10km
      active_time_in_seconds: Math.floor(3600 + Math.random() * 7200), // 1-3 hours
      calories_burned: Math.floor(1800 + Math.random() * 800), // 1800-2600 calories
      floors_climbed: Math.floor(Math.random() * 20), // 0-20 floors
      sleep_duration_in_seconds: Math.floor(25200 + Math.random() * 7200), // 7-9 hours
      deep_sleep_duration_in_seconds: Math.floor(5400 + Math.random() * 3600), // 1.5-2.5 hours
      light_sleep_duration_in_seconds: Math.floor(10800 + Math.random() * 3600), // 3-4 hours
      rem_sleep_duration_in_seconds: Math.floor(5400 + Math.random() * 1800), // 1.5-2 hours
      awake_duration_in_seconds: Math.floor(Math.random() * 1800), // 0-30 minutes
      resting_heart_rate: Math.floor(55 + Math.random() * 20), // 55-75 bpm
      stress_score: Math.floor(20 + Math.random() * 60), // 20-80
      body_battery_drained: Math.floor(20 + Math.random() * 40), // 20-60
      body_battery_charged: Math.floor(40 + Math.random() * 40), // 40-80
      moderate_intensity_minutes: Math.floor(Math.random() * 60), // 0-60 minutes
      vigorous_intensity_minutes: Math.floor(Math.random() * 30), // 0-30 minutes
    });
  }
  
  return healthData;
}
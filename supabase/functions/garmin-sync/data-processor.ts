// Data processing utilities for Garmin activities and daily health data

// Process Activity API response data
export function processGarminActivities(activitiesData: any, userId: string) {
  console.log('=== GARMIN ACTIVITIES PROCESSING START ===');
  console.log('Processing Garmin activities for user:', userId);
  console.log('Raw activities data type:', typeof activitiesData);
  console.log('Raw activities data length:', Array.isArray(activitiesData) ? activitiesData.length : 'Not array');
  console.log('Raw activities data structure (first 1000 chars):', JSON.stringify(activitiesData, null, 2).substring(0, 1000));
  
  if (!Array.isArray(activitiesData)) {
    console.warn('Activities data is not an array:', typeof activitiesData);
    console.log('Attempting to extract array from object structure...');
    
    // Try to find activities in common object structures
    if (activitiesData && typeof activitiesData === 'object') {
      const possibleArrays = activitiesData.activities || activitiesData.data || activitiesData.results || activitiesData.items;
      if (Array.isArray(possibleArrays)) {
        console.log('Found activities array in object structure, length:', possibleArrays.length);
        activitiesData = possibleArrays;
      } else {
        console.log('Converting single object to array');
        activitiesData = [activitiesData];
      }
    } else {
      return [];
    }
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
    
    // Extract timestamps - Garmin uses various formats and field names
    // DO NOT fallback to current date - we want the actual activity date
    const startDate = activity.startTimeGMT || activity.startTimeLocal || activity.beginTimestamp || 
                     activity.startTime || activity.activityStartTime || activity.startDateTime ||
                     activity.dateTime || activity.activityDate || activity.summaryDateTime ||
                     activity.calendarDate || null;
    
    console.log('Activity date extraction:', {
      original_startTimeGMT: activity.startTimeGMT,
      original_startTimeLocal: activity.startTimeLocal,
      original_beginTimestamp: activity.beginTimestamp,
      original_startTime: activity.startTime,
      original_activityStartTime: activity.activityStartTime,
      original_startDateTime: activity.startDateTime,
      original_dateTime: activity.dateTime,
      original_activityDate: activity.activityDate,
      original_summaryDateTime: activity.summaryDateTime,
      original_calendarDate: activity.calendarDate,
      mapped_startDate: startDate
    });
    
    // Extract activity metrics with Garmin-specific field names (checking both possible formats)
    const distance = activity.distance || activity.distanceInMeters || activity.distanceInKilometers || null;
    
    // Duration fields - Garmin often provides these in seconds
    const movingTime = activity.movingDuration || activity.elapsedDuration || activity.duration || 
                      activity.movingTimeInSeconds || activity.elapsedTimeInSeconds || null;
    const elapsedTime = activity.elapsedDuration || activity.duration || activity.elapsedTimeInSeconds || 
                       activity.totalTimeInSeconds || null;
    
    // Elevation in meters
    const elevationGain = activity.elevationGain || activity.elevationCorrected || activity.totalElevationGain || 
                         activity.elevationGainInMeters || null;
    
    // Speed metrics (Garmin typically uses m/s, but sometimes km/h)
    const avgSpeed = activity.averageSpeed || activity.avgSpeed || activity.averageSpeedInMetersPerSecond ||
                    activity.averageSpeedInKmPerHour || null;
    const maxSpeed = activity.maxSpeed || activity.maximumSpeed || activity.maxSpeedInMetersPerSecond ||
                    activity.maxSpeedInKmPerHour || null;
    
    // Heart rate metrics (in BPM)
    const avgHR = activity.averageHR || activity.avgHeartRate || activity.averageHeartRate || 
                 activity.averageHeartRateInBeatsPerMinute || activity.avgHr || null;
    const maxHR = activity.maxHR || activity.maxHeartRate || activity.maximumHeartRate || 
                 activity.maxHeartRateInBeatsPerMinute || activity.maxHr || null;
    
    // Calories (active calories or total calories)
    const calories = activity.calories || activity.activeKilocalories || activity.totalKilocalories || 
                    activity.caloriesBurned || activity.energyExpended || null;
    
    // Environmental data
    const avgTemp = activity.avgTemperature || activity.averageTemperature || activity.temperature?.avg || 
                   activity.weather?.temperature?.avg || activity.environmentalData?.avgTemperature || null;
    const maxTemp = activity.maxTemperature || activity.maximumTemperature || activity.temperature?.max || 
                   activity.weather?.temperature?.max || activity.environmentalData?.maxTemperature || null;
    const weatherCondition = activity.weatherCondition || activity.weather?.condition || activity.weather?.description || 
                            activity.environmentalData?.weatherCondition || null;
    
    // Location data
    const startLat = activity.startLatitude || activity.startLat || activity.location?.start?.latitude || 
                    activity.gps?.start?.lat || activity.beginLatitude || null;
    const startLng = activity.startLongitude || activity.startLng || activity.location?.start?.longitude || 
                    activity.gps?.start?.lng || activity.beginLongitude || null;
    const endLat = activity.endLatitude || activity.endLat || activity.location?.end?.latitude || 
                  activity.gps?.end?.lat || activity.endingLatitude || null;
    const endLng = activity.endLongitude || activity.endLng || activity.location?.end?.longitude || 
                  activity.gps?.end?.lng || activity.endingLongitude || null;
    
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
      mapped_calories: calories,
      // Environmental fields
      original_avgTemperature: activity.avgTemperature,
      original_maxTemperature: activity.maxTemperature,
      original_weatherCondition: activity.weatherCondition,
      mapped_avgTemp: avgTemp,
      mapped_maxTemp: maxTemp,
      mapped_weatherCondition: weatherCondition,
      // Location fields
      original_startLatitude: activity.startLatitude,
      original_startLongitude: activity.startLongitude,
      original_endLatitude: activity.endLatitude,
      original_endLongitude: activity.endLongitude,
      mapped_startLat: startLat,
      mapped_startLng: startLng,
      mapped_endLat: endLat,
      mapped_endLng: endLng
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
      calories: calories ? parseFloat(calories.toString()) : null,
      avg_temperature: avgTemp ? parseFloat(avgTemp.toString()) : null,
      max_temperature: maxTemp ? parseFloat(maxTemp.toString()) : null,
      weather_condition: weatherCondition,
      start_latitude: startLat ? parseFloat(startLat.toString()) : null,
      start_longitude: startLng ? parseFloat(startLng.toString()) : null,
      end_latitude: endLat ? parseFloat(endLat.toString()) : null,
      end_longitude: endLng ? parseFloat(endLng.toString()) : null
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
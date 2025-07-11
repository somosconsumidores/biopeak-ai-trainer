// Database operations for Garmin activities and daily health data

// Insert Garmin activities
export async function insertGarminActivities(supabase: any, activities: any[]) {
  console.log(`Processing ${activities.length} activities for insertion`);
  console.log('Sample activity data:', JSON.stringify(activities[0], null, 2));

  // Insert activities with better error handling
  const { data: insertedData, error: insertError } = await supabase
    .from('garmin_activities')
    .upsert(activities, { 
      onConflict: 'user_id,garmin_activity_id',
      ignoreDuplicates: false 
    })
    .select();

  if (insertError) {
    console.error('Error inserting activities:', insertError);
    console.error('Error details:', JSON.stringify(insertError, null, 2));
    
    // If upsert fails due to constraint, try individual inserts
    console.log('Attempting individual inserts as fallback...');
    let successCount = 0;
    
    for (const activity of activities) {
      try {
        const { error: singleError } = await supabase
          .from('garmin_activities')
          .insert(activity)
          .select();
          
        if (!singleError) {
          successCount++;
        } else {
          console.error(`Failed to insert activity ${activity.garmin_activity_id}:`, singleError);
        }
      } catch (singleInsertError) {
        console.error(`Exception inserting activity ${activity.garmin_activity_id}:`, singleInsertError);
      }
    }
    
    console.log(`Successfully inserted ${successCount} activities individually`);
    
    if (successCount === 0) {
      throw new Error(`Failed to insert any activities: ${insertError.message}`);
    }
  } else {
    console.log('Successfully upserted activities:', insertedData?.length || activities.length);
    console.log('Inserted data sample:', JSON.stringify(insertedData?.[0], null, 2));
  }

  return insertedData;
}

// Insert Garmin daily health data
export async function insertGarminDailyHealth(supabase: any, healthData: any[]) {
  console.log(`Processing ${healthData.length} daily health records for insertion`);
  if (healthData.length > 0) {
    console.log('Sample daily health data:', JSON.stringify(healthData[0], null, 2));
  }

  // Insert daily health data with better error handling
  const { data: insertedData, error: insertError } = await supabase
    .from('garmin_daily_health')
    .upsert(healthData, { 
      onConflict: 'user_id,summary_date',
      ignoreDuplicates: false 
    })
    .select();

  if (insertError) {
    console.error('Error inserting daily health data:', insertError);
    console.error('Error details:', JSON.stringify(insertError, null, 2));
    
    // If upsert fails due to constraint, try individual inserts
    console.log('Attempting individual daily health inserts as fallback...');
    let successCount = 0;
    
    for (const healthRecord of healthData) {
      try {
        const { error: singleError } = await supabase
          .from('garmin_daily_health')
          .insert(healthRecord)
          .select();
          
        if (!singleError) {
          successCount++;
        } else {
          console.error(`Failed to insert daily health record ${healthRecord.summary_date}:`, singleError);
        }
      } catch (singleInsertError) {
        console.error(`Exception inserting daily health record ${healthRecord.summary_date}:`, singleInsertError);
      }
    }
    
    console.log(`Successfully inserted ${successCount} daily health records individually`);
    
    if (successCount === 0) {
      throw new Error(`Failed to insert any daily health data: ${insertError.message}`);
    }
  } else {
    console.log('Successfully upserted daily health data:', insertedData?.length || healthData.length);
    if (insertedData && insertedData.length > 0) {
      console.log('Inserted daily health data sample:', JSON.stringify(insertedData[0], null, 2));
    }
  }

  return insertedData;
}

export async function verifyInsertedData(supabase: any, userId: string) {
  // Verify activities were inserted
  const { data: activityData, error: activityError } = await supabase
    .from('garmin_activities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Verify daily health data was inserted
  const { data: healthData, error: healthError } = await supabase
    .from('garmin_daily_health')
    .select('*')
    .eq('user_id', userId)
    .order('summary_date', { ascending: false })
    .limit(5);

  if (activityError) {
    console.error('Error verifying inserted activity data:', activityError);
  } else {
    console.log(`Verification: Found ${activityData?.length || 0} activities in database for user`);
    if (activityData && activityData.length > 0) {
      console.log('Recent activities:', JSON.stringify(activityData.slice(0, 2), null, 2));
    }
  }

  if (healthError) {
    console.error('Error verifying inserted daily health data:', healthError);
  } else {
    console.log(`Verification: Found ${healthData?.length || 0} daily health records in database for user`);
    if (healthData && healthData.length > 0) {
      console.log('Recent daily health data:', JSON.stringify(healthData.slice(0, 2), null, 2));
    }
  }

  return { activities: activityData, dailyHealth: healthData };
}

// Insert Garmin VO2 Max data
export async function insertGarminVo2Max(supabase: any, vo2MaxData: any[]) {
  console.log(`Processing ${vo2MaxData.length} VO2 Max records for insertion`);
  if (vo2MaxData.length > 0) {
    console.log('Sample VO2 Max data:', JSON.stringify(vo2MaxData[0], null, 2));
  }

  if (vo2MaxData.length === 0) {
    console.log('No VO2 Max data to insert');
    return [];
  }

  // Insert VO2 Max data with upsert to handle duplicates
  const { data: insertedData, error: insertError } = await supabase
    .from('garmin_vo2_max')
    .upsert(vo2MaxData, { 
      onConflict: 'user_id,measurement_date',
      ignoreDuplicates: false 
    })
    .select();

  if (insertError) {
    console.error('Error inserting VO2 Max data:', insertError);
    console.error('Error details:', JSON.stringify(insertError, null, 2));
    
    // If upsert fails, try individual inserts
    console.log('Attempting individual VO2 Max inserts as fallback...');
    let successCount = 0;
    
    for (const vo2MaxRecord of vo2MaxData) {
      try {
        const { error: singleError } = await supabase
          .from('garmin_vo2_max')
          .insert(vo2MaxRecord)
          .select();
          
        if (!singleError) {
          successCount++;
        } else {
          console.error(`Failed to insert VO2 Max record ${vo2MaxRecord.measurement_date}:`, singleError);
        }
      } catch (singleInsertError) {
        console.error(`Exception inserting VO2 Max record ${vo2MaxRecord.measurement_date}:`, singleInsertError);
      }
    }
    
    console.log(`Successfully inserted ${successCount} VO2 Max records individually`);
    
    if (successCount === 0) {
      throw new Error(`Failed to insert any VO2 Max data: ${insertError.message}`);
    }
  } else {
    console.log('Successfully upserted VO2 Max data:', insertedData?.length || vo2MaxData.length);
    if (insertedData && insertedData.length > 0) {
      console.log('Inserted VO2 Max data sample:', JSON.stringify(insertedData[0], null, 2));
    }
  }

  return insertedData;
}
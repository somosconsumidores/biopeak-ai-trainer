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
  console.log(`=== VO2 MAX INSERTION PROCESS STARTED ===`);
  console.log(`Processing ${vo2MaxData.length} VO2 Max records for insertion`);
  
  if (vo2MaxData.length === 0) {
    console.log('❌ No VO2 Max data to insert');
    return [];
  }

  // Log detailed information about each record being inserted
  console.log('📊 VO2 Max Records to be inserted:');
  vo2MaxData.forEach((record, index) => {
    console.log(`   ${index + 1}. Date: ${record.measurement_date}, VO2: ${record.vo2_max_value}, Fitness Age: ${record.fitness_age}, User: ${record.user_id}`);
  });
  
  console.log('Sample VO2 Max data structure:', JSON.stringify(vo2MaxData[0], null, 2));

  // Check existing records before insertion
  const { data: existingRecords, error: existingError } = await supabase
    .from('garmin_vo2_max')
    .select('measurement_date, vo2_max_value, fitness_age')
    .eq('user_id', vo2MaxData[0]?.user_id)
    .order('measurement_date', { ascending: false });

  if (!existingError) {
    console.log(`📈 Found ${existingRecords?.length || 0} existing VO2 Max records for user`);
    if (existingRecords && existingRecords.length > 0) {
      console.log('🔍 Recent existing records:');
      existingRecords.slice(0, 3).forEach((record, index) => {
        console.log(`   ${index + 1}. Date: ${record.measurement_date}, VO2: ${record.vo2_max_value}, Fitness Age: ${record.fitness_age}`);
      });
    }
  } else {
    console.error('❌ Error checking existing records:', existingError);
  }

  // Attempt upsert operation
  console.log('🔄 Starting upsert operation...');
  const { data: insertedData, error: insertError } = await supabase
    .from('garmin_vo2_max')
    .upsert(vo2MaxData, { 
      onConflict: 'user_id,measurement_date',
      ignoreDuplicates: false 
    })
    .select();

  if (insertError) {
    console.error('❌ UPSERT FAILED - Error inserting VO2 Max data:', insertError);
    console.error('❌ Error details:', JSON.stringify(insertError, null, 2));
    console.error('❌ Error code:', insertError.code);
    console.error('❌ Error message:', insertError.message);
    
    // If upsert fails, try individual inserts with detailed logging
    console.log('🔧 Attempting individual VO2 Max inserts as fallback...');
    let successCount = 0;
    const individualResults = [];
    
    for (let i = 0; i < vo2MaxData.length; i++) {
      const vo2MaxRecord = vo2MaxData[i];
      console.log(`🔄 Inserting individual record ${i + 1}/${vo2MaxData.length}:`, JSON.stringify(vo2MaxRecord, null, 2));
      
      try {
        const { data: singleData, error: singleError } = await supabase
          .from('garmin_vo2_max')
          .upsert(vo2MaxRecord, { 
            onConflict: 'user_id,measurement_date',
            ignoreDuplicates: false 
          })
          .select();
          
        if (!singleError) {
          successCount++;
          individualResults.push(singleData);
          console.log(`✅ Successfully inserted/updated record ${i + 1}: ${vo2MaxRecord.measurement_date}`);
        } else {
          console.error(`❌ Failed to insert VO2 Max record ${vo2MaxRecord.measurement_date}:`, singleError);
          console.error(`❌ Single error details:`, JSON.stringify(singleError, null, 2));
        }
      } catch (singleInsertError) {
        console.error(`❌ Exception inserting VO2 Max record ${vo2MaxRecord.measurement_date}:`, singleInsertError);
      }
    }
    
    console.log(`📊 Individual insert results: ${successCount}/${vo2MaxData.length} successful`);
    
    if (successCount === 0) {
      throw new Error(`Failed to insert any VO2 Max data: ${insertError.message}`);
    }
    
    return individualResults.flat();
  } else {
    console.log('✅ Successfully upserted VO2 Max data!');
    console.log(`📊 Records processed: ${insertedData?.length || vo2MaxData.length}`);
    
    if (insertedData && insertedData.length > 0) {
      console.log('✅ Insertion successful - sample of inserted data:', JSON.stringify(insertedData[0], null, 2));
      console.log('📈 All inserted records:');
      insertedData.forEach((record, index) => {
        console.log(`   ${index + 1}. Date: ${record.measurement_date}, VO2: ${record.vo2_max_value}, Fitness Age: ${record.fitness_age}`);
      });
    } else {
      console.log('⚠️ No data returned from upsert operation (this might be normal for updates)');
    }
  }

  console.log(`=== VO2 MAX INSERTION PROCESS COMPLETED ===`);
  return insertedData;
}

// Verify VO2 Max data insertion
export async function verifyVo2MaxInsertion(supabase: any, userId: string) {
  console.log(`=== VERIFYING VO2 MAX DATA FOR USER ${userId} ===`);
  
  const { data: vo2Data, error: vo2Error } = await supabase
    .from('garmin_vo2_max')
    .select('*')
    .eq('user_id', userId)
    .order('measurement_date', { ascending: false });

  if (vo2Error) {
    console.error('❌ Error verifying VO2 Max data:', vo2Error);
    return null;
  } else {
    console.log(`📊 Verification: Found ${vo2Data?.length || 0} VO2 Max records in database for user`);
    
    if (vo2Data && vo2Data.length > 0) {
      console.log('📈 All VO2 Max records in database:');
      vo2Data.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.measurement_date}: VO2=${record.vo2_max_value}, Fitness Age=${record.fitness_age}, ID=${record.id}`);
      });
      
      console.log('🔍 Recent VO2 Max records details:', JSON.stringify(vo2Data.slice(0, 3), null, 2));
    } else {
      console.log('❌ No VO2 Max records found in database!');
    }
    
    return vo2Data;
  }
}
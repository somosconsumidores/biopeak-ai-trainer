// Database operations for Garmin activities
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

export async function verifyInsertedData(supabase: any, userId: string) {
  // Verify data was actually inserted
  const { data: verificationData, error: verificationError } = await supabase
    .from('garmin_activities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (verificationError) {
    console.error('Error verifying inserted data:', verificationError);
  } else {
    console.log(`Verification: Found ${verificationData?.length || 0} activities in database for user`);
    console.log('Recent activities:', JSON.stringify(verificationData?.slice(0, 3), null, 2));
  }

  return verificationData;
}
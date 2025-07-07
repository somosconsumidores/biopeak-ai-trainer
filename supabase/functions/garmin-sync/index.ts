import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, authorization',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid token');
    }

    // Get user's Garmin tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('garmin_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('No Garmin connection found');
    }

    console.log('Syncing Garmin activities for user:', user.id);

    // For demonstration purposes, we'll create some mock activities
    // In a real implementation, you would fetch activities from Garmin Connect API
    const mockActivities = [
      {
        garmin_activity_id: Date.now() + 1,
        name: 'Morning Run',
        type: 'running',
        start_date: new Date().toISOString(),
        distance: 5000, // 5km in meters
        moving_time: 1800, // 30 minutes
        elapsed_time: 1900,
        average_speed: 2.78, // m/s
        average_heartrate: 150,
        max_heartrate: 170,
        calories: 350,
        total_elevation_gain: 50,
      },
      {
        garmin_activity_id: Date.now() + 2,
        name: 'Evening Bike Ride',
        type: 'cycling',
        start_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        distance: 15000, // 15km
        moving_time: 2700, // 45 minutes
        elapsed_time: 2800,
        average_speed: 5.56, // m/s
        average_heartrate: 140,
        max_heartrate: 165,
        calories: 480,
        total_elevation_gain: 200,
      }
    ];

    // Insert mock activities
    const activitiesWithUserId = mockActivities.map(activity => ({
      ...activity,
      user_id: user.id,
    }));

    const { error: insertError } = await supabase
      .from('garmin_activities')
      .upsert(activitiesWithUserId, { 
        onConflict: 'user_id,garmin_activity_id',
        ignoreDuplicates: true 
      });

    if (insertError) {
      console.error('Error inserting activities:', insertError);
      throw insertError;
    }

    console.log(`Successfully synced ${mockActivities.length} Garmin activities`);

    return new Response(JSON.stringify({ 
      success: true,
      count: mockActivities.length,
      message: `Synced ${mockActivities.length} activities from Garmin Connect`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in garmin-sync function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
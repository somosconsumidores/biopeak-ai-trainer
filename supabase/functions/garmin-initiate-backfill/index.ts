import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface InitiateBackfillRequest {
  monthsBack: number;
  summaryTypes?: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[garmin-initiate-backfill] Starting initiate backfill function');

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[garmin-initiate-backfill] Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[garmin-initiate-backfill] No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[garmin-initiate-backfill] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[garmin-initiate-backfill] User authenticated:', user.id);

    // Only handle POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const requestBody: InitiateBackfillRequest = await req.json();
    const monthsBack = requestBody.monthsBack || 6;
    const summaryTypes = requestBody.summaryTypes || ['dailies'];

    console.log('[garmin-initiate-backfill] Months back requested:', monthsBack);
    console.log('[garmin-initiate-backfill] Summary types requested:', summaryTypes);

    // Check if user already has backfill records
    const { data: existingBackfills, error: checkError } = await supabase
      .from('garmin_backfill_status')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (checkError) {
      console.error('[garmin-initiate-backfill] Error checking existing backfills:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing backfills' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (existingBackfills && existingBackfills.length > 0) {
      console.log('[garmin-initiate-backfill] User already has backfill records');
      return new Response(
        JSON.stringify({ 
          existing: true, 
          message: 'User already has backfill records. Use manual backfill for additional periods.' 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate backfill periods (90-day chunks for the specified months)
    const now = new Date();
    const totalDays = monthsBack * 30; // Approximate days per month
    const periods: { start: Date; end: Date }[] = [];

    // Create 90-day chunks going back in time
    let currentEndDate = new Date(now);
    currentEndDate.setHours(23, 59, 59, 999); // End of day
    
    let remainingDays = totalDays;
    
    while (remainingDays > 0) {
      const chunkDays = Math.min(90, remainingDays);
      const periodStart = new Date(currentEndDate);
      periodStart.setDate(currentEndDate.getDate() - chunkDays + 1);
      periodStart.setHours(0, 0, 0, 0); // Start of day
      
      periods.push({ 
        start: new Date(periodStart), 
        end: new Date(currentEndDate) 
      });
      
      // Move to next chunk
      currentEndDate = new Date(periodStart);
      currentEndDate.setDate(periodStart.getDate() - 1);
      currentEndDate.setHours(23, 59, 59, 999);
      
      remainingDays -= chunkDays;
    }

    console.log('[garmin-initiate-backfill] Generated periods:', periods.length);

    // Create backfill records for each period and summary type combination
    const backfillRecords = [];
    for (const period of periods) {
      for (const summaryType of summaryTypes) {
        backfillRecords.push({
          user_id: user.id,
          period_start: period.start.toISOString(),
          period_end: period.end.toISOString(),
          summary_type: summaryType,
          status: 'pending',
          requested_at: new Date().toISOString(),
          activities_processed: 0,
          retry_count: 0,
          max_retries: 3,
          is_duplicate: false
        });
      }
    }

    const { data: insertedRecords, error: insertError } = await supabase
      .from('garmin_backfill_status')
      .insert(backfillRecords)
      .select();

    if (insertError) {
      console.error('[garmin-initiate-backfill] Error inserting backfill records:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create backfill records' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const successfulPeriods = insertedRecords?.length || 0;

    console.log('[garmin-initiate-backfill] Successfully created backfill records:', successfulPeriods);

    // Now call the garmin-backfill function for each unique period to actually start the process
    const uniquePeriods = new Set();
    const periodGroups = new Map();
    
    // Group records by period to batch summary types together
    for (const record of insertedRecords || []) {
      const periodKey = `${record.period_start}-${record.period_end}`;
      if (!periodGroups.has(periodKey)) {
        periodGroups.set(periodKey, []);
      }
      periodGroups.get(periodKey).push(record.summary_type);
      uniquePeriods.add(periodKey);
    }

    let processedCount = 0;
    for (const [periodKey, summaryTypesForPeriod] of periodGroups.entries()) {
      const [periodStart, periodEnd] = periodKey.split('-');
      
      try {
        const { error: backfillError } = await supabase.functions.invoke('garmin-backfill', {
          body: {
            periodStart,
            periodEnd,
            summaryTypes: summaryTypesForPeriod
          },
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!backfillError) {
          processedCount++;
        } else {
          console.error('[garmin-initiate-backfill] Error processing period:', backfillError);
        }
      } catch (error) {
        console.error('[garmin-initiate-backfill] Error calling garmin-backfill:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalPeriods: periods.length,
        totalRecords: backfillRecords.length,
        successfulPeriods,
        processedPeriods: processedCount,
        summaryTypes,
        message: `Initiated backfill for ${successfulPeriods} records across ${periods.length} periods and ${summaryTypes.length} summary types`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[garmin-initiate-backfill] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
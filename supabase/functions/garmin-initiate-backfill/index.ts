import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Garmin Initiate Backfill] Request received:', req.method);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid user token');
    }

    console.log('[Garmin Initiate Backfill] User authenticated:', user.id);

    if (req.method === 'POST') {
      const { monthsBack = 6 } = await req.json();
      
      console.log('[Garmin Initiate Backfill] Initiating backfill for', monthsBack, 'months');

      // Check if user has Garmin tokens
      const { data: tokenData, error: tokenError } = await supabase
        .from('garmin_tokens')
        .select('access_token')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tokenError || !tokenData) {
        throw new Error('User not connected to Garmin');
      }

      // Check if user already has backfill records
      const { data: existingBackfills } = await supabase
        .from('garmin_backfill_status')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (existingBackfills && existingBackfills.length > 0) {
        return new Response(
          JSON.stringify({ 
            message: 'User already has backfill records. Use manual backfill for additional periods.',
            existing: true
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Calculate periods (90-day chunks going back from today)
      const now = new Date();
      const periods = [];
      const maxMonths = Math.min(monthsBack, 6); // Garmin limit is 6 months
      
      for (let i = 0; i < maxMonths; i++) {
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() - (i * 3)); // 3-month chunks
        
        const periodStart = new Date(periodEnd);
        periodStart.setMonth(periodStart.getMonth() - 3);
        
        // Don't go back more than 6 months
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        if (periodStart < sixMonthsAgo) {
          periodStart.setTime(sixMonthsAgo.getTime());
        }
        
        if (periodStart >= periodEnd) {
          break;
        }
        
        periods.push({
          start: periodStart.toISOString(),
          end: periodEnd.toISOString()
        });
      }

      console.log('[Garmin Initiate Backfill] Calculated periods:', periods.length);

      const results = [];
      
      // Submit backfill requests with delay between them
      for (let i = 0; i < periods.length; i++) {
        const period = periods[i];
        
        try {
          console.log(`[Garmin Initiate Backfill] Submitting period ${i + 1}/${periods.length}:`, period);
          
          // Call the garmin-backfill function
          const { data, error } = await supabase.functions.invoke('garmin-backfill', {
            body: {
              periodStart: period.start,
              periodEnd: period.end
            },
            headers: {
              Authorization: authHeader
            }
          });

          if (error) {
            console.error(`[Garmin Initiate Backfill] Error in period ${i + 1}:`, error);
            results.push({
              period,
              success: false,
              error: error.message
            });
          } else {
            console.log(`[Garmin Initiate Backfill] Period ${i + 1} submitted successfully`);
            results.push({
              period,
              success: true,
              backfillId: data.backfillId
            });
          }

          // Add delay between requests to avoid rate limiting
          if (i < periods.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
          }

        } catch (error) {
          console.error(`[Garmin Initiate Backfill] Exception in period ${i + 1}:`, error);
          results.push({
            period,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      return new Response(
        JSON.stringify({ 
          message: `Initiated backfill for ${successCount}/${periods.length} periods`,
          results,
          totalPeriods: periods.length,
          successfulPeriods: successCount
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Garmin Initiate Backfill] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});